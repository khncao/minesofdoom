/**
 * Drift-guard tests for `node scripts/stripe/syncStripe.mjs verify` — the
 * read-only check the sk_live flip at launch relies on (docs/store-
 * integration.md §2.6 step 6). The script is driven as a real subprocess
 * against a local mock Stripe API (the script's STRIPE_API_BASE test seam);
 * the mock is built from the REAL catalog.json + storeConfig.ts so the
 * passing case means "the account matches exactly what the repo claims",
 * and the drift cases mutate the mock (amount, price id, missing product,
 * rogue product) to pin the finding messages.
 */
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import { spawn } from "child_process";

interface CatalogEntry {
  id: string;
  storeId: string;
  name: string;
  blurb: string;
  amountUsd: number;
}

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "stripe", "syncStripe.mjs");
const CATALOG = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "scripts", "stripe", "catalog.json"), "utf8"),
) as CatalogEntry[];

function parseRepo(): { publishableKey: string; prices: Record<string, string> } {
  const source = fs.readFileSync(
    path.join(REPO_ROOT, "src", "mines_of_doom", "storeConfig.ts"),
    "utf8",
  );
  const pk = /publishableKey:\s*"([^"]*)"/.exec(source);
  const block = /prices:\s*\{([^}]*)\}/.exec(source);
  const prices: Record<string, string> = {};
  if (block) {
    for (const m of block[1].matchAll(/(\w+)\s*:\s*"([^"]*)"/g)) {
      prices[m[1]] = m[2];
    }
  }
  return { publishableKey: pk ? pk[1] : "", prices };
}

interface MockOpts {
  /** catalog ids to omit from the products list (missing-product case) */
  omitIds?: string[];
  /** id whose live price id is mutated to a different one (stale-repo case) */
  mutatePriceId?: string;
  /** id whose live unit_amount is bumped by 100 (amount-drift case) */
  mutateAmount?: string;
  /** extra mdoom-marker product ids present only in the account */
  rogueIds?: string[];
}

function startMock(overrides: MockOpts = {}): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const repo = parseRepo();
  const omit = new Set(overrides.omitIds ?? []);
  const products = CATALOG.filter((e) => !omit.has(e.id)).map((e) => ({
    id: "prod_" + e.id,
    name: e.name,
    active: true,
    metadata: { mdoomProductId: e.id, mdoomStoreId: e.storeId },
  }));
  for (const id of overrides.rogueIds ?? []) {
    products.push({
      id: "prod_" + id,
      name: "rogue",
      active: true,
      metadata: { mdoomProductId: id, mdoomStoreId: id },
    });
  }
  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? "", "http://localhost");
    const send = (body: unknown) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (u.pathname === "/products") {
      return send({ object: "list", data: products, has_more: false });
    }
    if (u.pathname === "/prices") {
      const prodId = u.searchParams.get("product");
      const entry = CATALOG.find((e) => "prod_" + e.id === prodId);
      if (!entry) return send({ object: "list", data: [], has_more: false });
      let priceId = repo.prices[entry.id] ?? "price_unknown";
      if (overrides.mutatePriceId === entry.id) priceId = "price_mutated";
      const unitAmount =
        overrides.mutateAmount === entry.id
          ? entry.amountUsd + 100
          : entry.amountUsd;
      return send({
        object: "list",
        data: [{ id: priceId, unit_amount: unitAmount, active: true }],
        has_more: false,
      });
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "mock: no route " + u.pathname } }));
  });
  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolvePromise({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

/**
 * Async spawn — spawnSync would block the mock server's event loop
 * (the child could never get a response) — with a timeout so a hung
 * child fails the test instead of the suite.
 */
function runVerify(
  apiBase: string,
  secretKey: string,
  flags: string[] = [],
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [SCRIPT, "verify", ...flags], {
      env: {
        ...process.env,
        STRIPE_API_BASE: apiBase,
        STRIPE_SECRET_KEY: secretKey,
      },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      stderr += "\n(verify timed out)";
    }, 20000);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => {
      clearTimeout(timer);
      resolvePromise({ status, stdout, stderr });
    });
  });
}

afterEach(async () => {
  await mock?.close();
  mock = undefined;
});

let mock: Awaited<ReturnType<typeof startMock>> | undefined;

test("verify passes when the account matches catalog.json + storeConfig.ts", async () => {
  mock = await startMock();
  const r = await runVerify(mock.url, "sk_test_fixture000");
  expect(r.status).toBe(0);
  expect(r.stdout).toContain(`${CATALOG.length}/${CATALOG.length} products match`);
  expect(r.stderr).not.toContain("DRIFT");
});

test("verify flags a live amount that drifted from catalog.json", async () => {
  mock = await startMock({ mutateAmount: "packGold" });
  const r = await runVerify(mock.url, "sk_test_fixture000");
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("packGold");
  expect(r.stderr).toContain("amount drift");
});

test("verify flags a stale repo price id (post-flip half re-paste)", async () => {
  mock = await startMock({ mutatePriceId: "packGold" });
  const r = await runVerify(mock.url, "sk_test_fixture000");
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("packGold");
  expect(r.stderr).toContain("repo price id");
});

test("verify flags a product missing from the account", async () => {
  mock = await startMock({ omitIds: ["packFrost"] });
  const r = await runVerify(mock.url, "sk_test_fixture000");
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("packFrost");
  expect(r.stderr).toContain("missing");
});

test("verify flags a rogue mdoom-marker product in the account", async () => {
  mock = await startMock({ rogueIds: ["roguePack"] });
  const r = await runVerify(mock.url, "sk_test_fixture000");
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("roguePack");
  expect(r.stderr).toContain("unknown mdoom product");
});

test("verify flags the half flip: sk_live key against a still-test-mode repo", async () => {
  mock = await startMock();
  const r = await runVerify(mock.url, "sk_live_fixture000", ["--live"]);
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("half flip");
  expect(r.stderr).toContain("test-mode but the secret key is live-mode");
});
