#!/usr/bin/env node
/**
 * E2E static server — serves the STATIC WEB BUILD (dist/) for the Playwright
 * suite (playwright.config.ts). Two e2e-only extras, neither ships:
 *
 *  1. The AdSense loader tag in index.html gets `data-adbreak-test="on"`
 *     injected. That is Google's DOCUMENTED test mode for the Ad Placement
 *     API (the loader's data-adbreak-test attribute): the page renders MOCK
 *     ads and makes NO ad requests to Google servers, and cycles between the
 *     ad-loaded / ad-not-loaded scenarios so the app's no-fill path is
 *     exercised too. This is what keeps e2e runs clean — no live
 *     impressions, nothing to be "flagged". The ads.spec.ts "stubbed
 *     loader" test doesn't even reach Google (the loader response itself
 *     is intercepted); the "test mode" test uses this attribute.
 *
 *  2. GET /__e2e/ping — the Playwright webServer readiness probe.
 *
 * Everything else is plain static serving of dist/ with an index.html SPA
 * fallback (expo-router static export is a single-page app at /).
 */
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const DIST = resolve(process.env.E2E_WEB_DIST || "dist");
const PORT = Number(process.env.E2E_WEB_PORT || 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/**
 * Inject data-adbreak-test="on" into the adsbygoogle loader <script> tag.
 * Matches the tag regardless of attribute order (async, crossorigin, ...).
 * Returns { html, injected }.
 */
function injectTestMode(html) {
  const re =
    /<script\b(?=[^>]*\bsrc="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"]*")/;
  const m = re.exec(html);
  if (!m) return { html, injected: false };
  const at = m.index + m[0].length;
  return {
    html: html.slice(0, at) + ' data-adbreak-test="on"' + html.slice(at),
    injected: true,
  };
}

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    console.error(
      `[e2e:server] no ${join(DIST, "index.html")} — run the web export first ` +
        "(`expo export -p web`); the `test:e2e:web` script does this for you.",
    );
    process.exit(1);
  }

  let warnedAboutInjection = false;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const path = decodeURIComponent(url.pathname);

    if (path === "/__e2e/ping") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }

    // Static files from dist/, no path traversal.
    let file = normalize(join(DIST, path === "/" ? "index.html" : path));
    if (!file.startsWith(DIST)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    let body = null;
    try {
      body = await readFile(file);
    } catch {
      // SPA fallback: unknown non-file path → index.html (client-side router).
      try {
        body = await readFile(join(DIST, "index.html"));
      } catch {
        res.writeHead(404);
        res.end("not found");
        return;
      }
    }
    const isHtml =
      file.endsWith(".html") ||
      (file === join(DIST, "index.html") ? true : false);
    if (isHtml) {
      const text = body.toString("utf-8");
      const { html, injected } = injectTestMode(text);
      if (!injected && !warnedAboutInjection) {
        warnedAboutInjection = true;
        // Not fatal: the adsense tag is only emitted when the ad config is
        // present at build time; the suite's stubbed-loader test still runs.
        console.warn(
          "[e2e:server] warning: no adsbygoogle loader tag in index.html — " +
            "the AdSense test-mode test will have nothing to load.",
        );
      }
      body = Buffer.from(html, "utf-8");
    }
    res.writeHead(200, {
      "content-type":
        MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  });

  server.listen(PORT, () => {
    console.log(`[e2e:server] serving ${DIST} on http://localhost:${PORT}`);
  });
}

// readFileSync is imported for potential future use; keep imports used-only:
void readFileSync;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
