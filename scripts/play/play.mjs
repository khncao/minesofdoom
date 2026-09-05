#!/usr/bin/env node
/**
 * Play Console management CLI (Play Developer API v3, androidpublisher).
 *
 * What it covers
 *  - store listings (get / set, per language)
 *  - store images (list / upload / delete)
 *  - tracks & testings (inspect releases)
 *  - AAB uploads + releases onto tracks (internal / closed / production)
 *  - one-time products: full CRUD via the `monetization.onetimeproducts`
 *    publishing API (list / get / create / delete — the old `inappproducts`
 *    API is retired) + a catalog cross-check against
 *    src/mines_of_doom/iaps.ts (`products-check`); the skus in iaps.ts / the
 *    §2.1 price table in docs/store-integration.md are the exact product ids
 *    to create
 *
 * Credentials (never committed):
 *   1. --key <path>            path to the service-account JSON key
 *   2. PLAY_SERVICE_ACCOUNT_JSON   env — inline JSON or a path (same
 *                                  convention as the verification sidecar)
 *   3. ./play-service-account.json  at the project root
 *   4. Google Cloud default application credentials (ADC) — the
 *      GOOGLE_APPLICATION_CREDENTIALS file, the local ADC written by
 *      `gcloud auth application-default login` (~/.config/gcloud/...),
 *      or the GCE/GKE/AWS metadata server. Useful on dev machines
 *      without a downloaded SA key.
 *
 * Whatever credential is used needs "Manage apps (full access)" or at
 * minimum "View app details" + "Manage app releases" on the app (Play
 * Console → Users and permissions → API access). The product commands
 * (create-product / delete-product) additionally need the billing
 * permissions ("Manage orders and subscriptions" + "View financial data,
 * orders, and cancellation survey responses").
 *
 * Usage: npm run play -- <command> [options]
 *        node scripts/play/play.mjs <command> [options]
 *
 * Commands
 *   app                                  app details (versionCode, status)
 *   listings [--lang=en-US]              store listings, all or one language
 *   set-listing --lang=en-US --short=.. --full=.. [--video=..]
 *                                       update one language's listing
 *   images [--lang=en-US] [--imageType=..]
 *                                       list store images (ids for delete)
 *   upload-image --file=.. --imageType=phoneScreenshot [--lang=en-US]
 *                                       (the current API orders images by upload
 *                                       sequence; --order=N is not supported)
 *   delete-image --imageType=.. --id=.. [--lang=en-US]
 *   tracks                               tracks + current releases (testing
 *                                       status now lives on each track's `status`)
 *   upload --aab=app-release.aab         upload an AAB, prints the versionCode
 *   release --track=internal --upload=versionCode1[,vc2]
 *            [--message=..] [--status=completed|inProgress|draft|halted]
 *                                       release onto a track
 *   products [--sku=pack_gold]           list live products, or one product
 *   create-product --sku=pack_gold --title="Golden Pickaxe" --price=0.99
 *                  [--desc=..] [--lang=en-US] [--region=US] [--currency=USD]
 *                  [--auto-convert-prices]  create a one-time product
 *   activate-product --sku=..            activate the purchase option (DRAFT ->
                                        ACTIVE; the console's one-time step).
 *                              Once ACTIVE a one-time product is available on
 *                              ALL tracks (the v3 API has no per-track product
 *                              publishing) — if a tester's purchase says
 *                              "item could not be found", the account is not a
 *                              registered license tester (Play Console UI:
 *                              Testing -> License testers; the API only sets
 *                              googleGroups).
   delete-product --sku=.. --yes        delete a one-time product
 *   products-check                       compare live products vs iaps.ts
 *
 * Global options: --app=<packageName> (default: the app.config.ts package),
 *                 --key=<path> (credentials override), --no-commit (for
 *                 listing/image edits: stage without committing the edit).
 *
 * API notes (googleapis >= 17x androidpublisher v3 surface):
 *   - edits are started with edits.insert (there is no edits.get-all)
 *   - store listings live under edits.listings (was edits.storelistings)
 *   - images live under edits.images, listed per imageType
 *   - the top-level `apps` resource is gone — app details come from
 *     edits.details inside an edit
 *   - commit no longer takes changesNotInForAll; image upload takes no order
 */
import { createReadStream } from "node:fs";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { google } from "googleapis";

const PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const DEFAULT_APP = "com.minus4kelvin.minesofdoom";
const IMAGE_TYPES = [
  "phoneScreenshot",
  "sevenInchScreenshot",
  "tenInchScreenshot",
  "tvScreenshot",
  "wearOsScreenshot",
  "promoGraphic",
  "tvBanner",
  "appIcon",
  "featureGraphic",
  "icon",
];

// ---------- arg parsing ----------

function parseArgs(argv) {
  const args = { _: [] };
  for (const raw of argv) {
    const m = raw.match(/^--([\w-]+)(?:=(.*))?$/);
    if (m) {
      args[m[1]] = m[2] === undefined ? true : m[2];
    } else {
      args._.push(raw);
    }
  }
  return args;
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// ---------- credentials ----------

/** Accepts inline JSON or a file path (the sidecar's convention). */
async function loadServiceAccount() {
  const candidates = [];
  if (args.key) candidates.push(String(args.key));
  if (process.env.PLAY_SERVICE_ACCOUNT_JSON)
    candidates.push(process.env.PLAY_SERVICE_ACCOUNT_JSON);
  candidates.push(path.join(ROOT, "play-service-account.json"));

  for (const candidate of candidates) {
    const raw = candidate.trim();
    try {
      if (raw.startsWith("{")) return JSON.parse(raw);
      const p = path.resolve(ROOT, raw);
      if (
        (await access(p)
          .then(() => true)
          .catch(() => false)) &&
        !raw.includes("{")
      ) {
        return JSON.parse(await readFile(p, "utf8"));
      }
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/**
 * Resolve an auth client. Prefers an explicit service-account key (resolved
 * by loadServiceAccount: --key, PLAY_SERVICE_ACCOUNT_JSON,
 * ./play-service-account.json); falls back to Google Cloud default app
 * credentials (ADC). Only uses the auth bundled with googleapis.
 */
async function client() {
  const sa = await loadServiceAccount();
  try {
    // fromJSON returns an unscoped client, so scope it explicitly. Without a
    // key file, GoogleAuth resolves the default app credentials.
    const auth = sa
      ? google.auth.fromJSON(sa).createScoped(PLAY_SCOPE)
      : await new google.auth.GoogleAuth({ scopes: [PLAY_SCOPE] }).getClient();
    return google.androidpublisher({ version: "v3", auth });
  } catch (e) {
    fail(
      "no credentials found. Pass --key <path>, set PLAY_SERVICE_ACCOUNT_JSON, " +
        "place a key at ./play-service-account.json (gitignored), or use the " +
        "Google Cloud default app credentials: `gcloud auth application-default login` " +
        "or set GOOGLE_APPLICATION_CREDENTIALS\n  (" +
        (e?.message ?? e) +
        ")",
    );
  }
}

// ---------- edit plumbing ----------

/** Start a new edit (the current API has no "get current edit" call). */
async function newEdit(pub) {
  const { data: edit } = await pub.edits.insert({ packageName: app });
  return edit;
}

async function commitEdit(pub, edit) {
  const c = await pub.edits.commit({ packageName: app, editId: edit.id });
  console.error(`edit committed: ${JSON.stringify(c.data?.status ?? c.data)}`);
}

/** Run an edit, committing unless --no-commit. Always returns the api response. */
async function withEdit(pub, action, { commit = true } = {}) {
  const edit = await newEdit(pub);
  const result = await action(edit);
  if (commit && args["no-commit"] !== true) {
    await commitEdit(pub, edit);
  }
  return result;
}

/** Read-only: open an edit, read, then close the edit without committing. */
async function readInEdit(pub, action) {
  const edit = await newEdit(pub);
  try {
    return await action(edit);
  } finally {
    await pub.edits
      .delete({ packageName: app, editId: edit.id })
      .catch(() => {});
  }
}

// ---------- commands ----------

const out = (v) => console.log(JSON.stringify(v, null, 2));

async function cmdApp(pub) {
  // The top-level `apps` resource is gone; app details live under edits.details.
  await readInEdit(pub, async (edit) => {
    const { data } = await pub.edits.details.get({
      packageName: app,
      editId: edit.id,
    });
    out(data);
  });
}

async function cmdListings(pub) {
  const lang = args.lang;
  if (lang) {
    await readInEdit(pub, async (edit) => {
      const res = await pub.edits.listings
        .get({
          packageName: app,
          editId: edit.id,
          language: lang,
        })
        .catch(() => ({ data: null }));
      out(
        res.data ?? {
          language: lang,
          note: "no listing for this language yet",
        },
      );
    });
    return;
  }
  await readInEdit(pub, async (edit) => {
    const { data } = await pub.edits.listings.list({
      packageName: app,
      editId: edit.id,
    });
    out(data.listings ?? []);
  });
}

async function cmdSetListing(pub) {
  const lang = args.lang;
  if (!lang || !args.full)
    fail("set-listing needs --lang=en-US and --full=… (and usually --short=…)");
  await withEdit(pub, async (edit) => {
    const { data } = await pub.edits.listings.patch({
      packageName: app,
      editId: edit.id,
      language: lang,
      requestBody: {
        language: lang,
        title: args.title ?? undefined,
        shortDescription: args.short ?? undefined,
        fullDescription: args.full,
        video: args.video ?? undefined,
      },
    });
    out(data);
  });
}

async function cmdImages(pub) {
  const lang = args.lang;
  if (!lang) fail("images needs --lang=en-US");
  await readInEdit(pub, async (edit) => {
    // Current API: images are listed per imageType.
    if (args.imageType) {
      const { data } = await pub.edits.images.list({
        packageName: app,
        editId: edit.id,
        language: lang,
        imageType: args.imageType,
      });
      out(data);
      return;
    }
    const outMap = {};
    for (const type of IMAGE_TYPES) {
      const { data } = await pub.edits.images
        .list({
          packageName: app,
          editId: edit.id,
          language: lang,
          imageType: type,
        })
        .catch(() => ({ data: null }));
      if (data?.images?.length) outMap[type] = data.images;
    }
    out(outMap);
  });
}

async function cmdUploadImage(pub) {
  const { file, imageType, lang } = args;
  if (args.order !== undefined)
    fail(
      "--order is not supported by the current API — images are ordered by upload sequence; delete + re-upload instead",
    );
  if (!file || !imageType || !IMAGE_TYPES.includes(imageType))
    fail(
      `upload-image needs --file=… and --imageType=<one of ${IMAGE_TYPES.join(", ")}`,
    );
  if (!lang) fail("upload-image needs --lang=en-US");
  await withEdit(pub, async (edit) => {
    const p = path.resolve(ROOT, String(file));
    const mime =
      p.toLowerCase().endsWith(".jpg") || p.toLowerCase().endsWith(".jpeg")
        ? "image/jpeg"
        : "image/png";
    const { data } = await pub.edits.images.upload({
      packageName: app,
      editId: edit.id,
      language: lang,
      imageType,
      media: { mimeType: mime, body: createReadStream(p) },
    });
    out(data);
  });
}

async function cmdDeleteImage(pub) {
  const { imageType, id, lang } = args;
  if (!imageType || !id || !lang)
    fail("delete-image needs --imageType=…, --id=… and --lang=…");
  await withEdit(pub, async (edit) => {
    const { data } = await pub.edits.images.delete({
      packageName: app,
      editId: edit.id,
      language: lang,
      imageType,
      imageId: String(id),
    });
    out(data);
  });
}

async function cmdTracks(pub) {
  // The separate testings resource was folded into tracks (`status`).
  await readInEdit(pub, async (edit) => {
    const { data } = await pub.edits.tracks.list({
      packageName: app,
      editId: edit.id,
    });
    out(data.tracks ?? []);
  });
}

async function cmdUpload(pub) {
  const aab = args.aab;
  if (!aab) fail("upload needs --aab=app-release.aab");
  const p = path.resolve(ROOT, String(aab));
  // The bundle only exists once the edit is committed — withEdit commits
  // unless --no-commit.
  const data = await withEdit(pub, async (edit) => {
    const { data } = await pub.edits.bundles.upload({
      packageName: app,
      editId: edit.id,
      media: { mimeType: "application/octet-stream", body: createReadStream(p) },
    });
    return data;
  });
  console.error(
    `uploaded. Release it with:\n  npm run play -- release --track=internal --upload=${data.versionCode}`,
  );
  out(data);
}

async function cmdRelease(pub) {
  const { track, upload, message, status } = args;
  if (!track || !upload)
    fail("release needs --track=internal and --upload=<id>[,<id>…]");
  const releases = [
    {
      name:
        args.name ??
        `play-cli ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      versionCodes: String(upload)
        .split(",")
        .map((s) => s.trim()),
      status: status ?? "completed",
      // LocalizedText, not a bare string
      ...(message ? { releaseNotes: [{ text: message }] } : {}),
    },
  ];
  await withEdit(pub, async (edit) => {
    const { data } = await pub.edits.tracks.patch({
      packageName: app,
      editId: edit.id,
      track,
      requestBody: { track, releases },
    });
    out(data);
  });
}

// The old `inappproducts` (v3) API is retired — calls to it now return
// "Please migrate to the new publishing API". Products live under
// monetization.onetimeproducts instead.

async function listAllProducts(pub) {
  const all = [];
  let pageToken;
  do {
    const { data } = await pub.monetization.onetimeproducts.list({
      packageName: app,
      pageToken,
    });
    all.push(...(data.oneTimeProducts ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
}

function moneyToUnitsNanos(num) {
  const units = Math.floor(num);
  const nanos = Math.round((num - units) * 1e9);
  return { units: String(units), nanos };
}

async function cmdProducts(pub) {
  if (args.sku) {
    const { data } = await pub.monetization.onetimeproducts.get({
      packageName: app,
      productId: String(args.sku),
    });
    out(data);
    return;
  }
  const products = await listAllProducts(pub);
  out(
    products.map((p) => ({
      productId: p.productId,
      listings: p.listings,
      purchaseOptions: (p.purchaseOptions ?? []).map((o) => ({
        purchaseOptionId: o.purchaseOptionId,
        state: o.state,
        prices: (o.regionalPricingAndAvailabilityConfigs ?? [])
          .filter((c) => c.price)
          .map((c) => ({
            region: c.regionCode,
            currencyCode: c.price.currencyCode,
            units: c.price.units,
            nanos: c.price.nanos,
            availability: c.availability,
          })),
      })),
    })),
  );
}

async function cmdCreateProduct(pub) {
  const { sku, title, price } = args;
  if (!sku || !title || price === undefined)
    fail("create-product needs --sku=…, --title=… and --price=0.99");
  const lang = String(args.lang ?? "en-US");
  const region = String(args.region ?? "US");
  const currency = String(args.currency ?? "USD");
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum <= 0)
    fail("--price must be a positive number (e.g. --price=0.99)");
  const basePrice = { currencyCode: currency, ...moneyToUnitsNanos(priceNum) };

  // Required first step: get the current regions version (and, with
  // --auto-convert-prices, the server-converted price for every region).
  const { data: conv } = await pub.monetization.convertRegionPrices({
    packageName: app,
    requestBody: { price: basePrice },
  });
  if (!conv.regionVersion?.version) fail("API did not return a regions version");

  let configs;
  if (args["auto-convert-prices"] === true) {
    configs = Object.keys(conv.convertedRegionPrices ?? {})
      .map((code) => ({
        regionCode: code,
        availability: "AVAILABLE",
        price: conv.convertedRegionPrices[code].price,
      }))
      .filter((c) => c.price);
  } else {
    configs = [
      {
        regionCode: region,
        availability: "AVAILABLE",
        price: basePrice,
      },
    ];
  }
  if (!configs.length) fail("no regional prices to set");

  const body = {
    packageName: app,
    productId: String(sku),
    listings: [
      {
        languageCode: lang,
        title: String(title),
        description: String(args.desc ?? title),
      },
    ],
    purchaseOptions: [
      {
        purchaseOptionId: "standard",
        buyOption: { legacyCompatible: true },
        regionalPricingAndAvailabilityConfigs: configs,
      },
    ],
  };
  // The new publishing API has no insert; patch with allowMissing upserts.
  // regionsVersion.version + updateMask are flattened query params.
  const { data } = await pub.monetization.onetimeproducts.patch({
    packageName: app,
    productId: String(sku),
    allowMissing: true,
    "regionsVersion.version": conv.regionVersion.version,
    updateMask: "listings,purchaseOptions",
    requestBody: body,
  });
  console.error(
    `saved ${sku}. Check the purchase option came back ACTIVE with: ` +
      `npm run play -- products --sku=${sku}`,
  );
  out(data);
}

/** Flip the product's purchase option from DRAFT to ACTIVE — the API
 * equivalent of the one-time "activate" step in the Play Console.
 * (monetization has no edits — the call is immediate.) */
async function cmdActivateProduct(pub) {
  const { sku } = args;
  if (!sku) fail("activate-product needs --sku=…");
  const { data } = await pub.monetization.onetimeproducts.purchaseOptions
    .batchUpdateStates({
      packageName: app,
      productId: String(sku),
      requestBody: {
        requests: [
          {
            activatePurchaseOptionRequest: {
              packageName: app,
              productId: String(sku),
              purchaseOptionId: "standard",
            },
          },
        ],
      },
    });
  console.error(`activated ${sku}`);
  out(data);
}

async function cmdDeleteProduct(pub) {
  const { sku, yes } = args;
  if (!sku) fail("delete-product needs --sku=…");
  if (yes !== true)
    fail("delete-product is destructive — re-run with --yes to confirm");
  const { data } = await pub.monetization.onetimeproducts.delete({
    packageName: app,
    productId: String(sku),
  });
  out(data);
}

/** Derive the expected store ids the same way iaps.ts does:
 *  remove_ads + pack_<cosmeticId> for every PACK_SPECS row. */
async function expectedStoreIds() {
  const src = await readFile(
    path.join(ROOT, "src/mines_of_doom/iaps.ts"),
    "utf8",
  );
  const block = src.slice(src.indexOf("PACK_SPECS"));
  const ids = new Set(["remove_ads"]);
  for (const m of block.matchAll(/cosmeticId:\s*"([\w-]+)"/g))
    ids.add("pack_" + m[1]);
  return [...ids].sort();
}

async function cmdProductsCheck(pub) {
  const expected = await expectedStoreIds();
  const live = new Set((await listAllProducts(pub)).map((p) => p.productId));
  const missing = expected.filter((id) => !live.has(id));
  const extra = [...live].filter((id) => !expected.includes(id));
  console.log(
    `expected ${expected.length} (iaps.ts), live ${live.size}; missing ${missing.length}, extra ${extra.length}`,
  );
  if (missing.length)
    console.log(
      "missing (create in the console — see docs/store-integration.md §2.1):",
    );
  for (const id of missing) console.log(`  - ${id}`);
  if (extra.length) {
    console.log("live but not in the catalog (check for typos):");
    for (const id of extra) console.log(`  - ${id}`);
  }
  process.exitCode = missing.length || extra.length ? 1 : 0;
}

// ---------- dispatch ----------

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const app = args.app ?? DEFAULT_APP;

const COMMANDS = {
  app: cmdApp,
  listings: cmdListings,
  "set-listing": cmdSetListing,
  images: cmdImages,
  "upload-image": cmdUploadImage,
  "delete-image": cmdDeleteImage,
  tracks: cmdTracks,
  upload: cmdUpload,
  release: cmdRelease,
  products: cmdProducts,
  "create-product": cmdCreateProduct,
  "activate-product": cmdActivateProduct,
  "delete-product": cmdDeleteProduct,
  "products-check": cmdProductsCheck,
};

const fn = COMMANDS[cmd];
if (!cmd || !fn) {
  console.error(
    "minesofdoom play-cli — manage the Play Console via the Play Developer API\n\n" +
      "commands:\n" +
      Object.keys(COMMANDS)
        .map((c) => `  ${c}`)
        .join("\n") +
      "\n\nglobals: --app=<packageName> (default " +
      DEFAULT_APP +
      ") --key=<sa.json> " +
      "--no-commit",
  );
  process.exit(cmd ? 1 : 0);
}
const pub = await client();
try {
  await fn(pub);
} catch (e) {
  const msg = e?.response?.data?.error?.message ?? e?.message ?? String(e);
  fail(msg);
}
