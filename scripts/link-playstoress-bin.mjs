#!/usr/bin/env node
/**
 * Link `playstoress` into node_modules/.bin so `pnpm exec playstoress`
 * works (pnpm, unlike npm, does not link the root package's own bins).
 * Runs on every `pnpm install` (postinstall) and is idempotent.
 */
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, "scripts", "playstoress.mjs");
const binDir = join(root, "node_modules", ".bin");

if (!existsSync(target)) {
  console.warn("[playstoress-bin] scripts/playstoress.mjs missing — skipped");
  process.exit(0);
}

mkdirSync(binDir, { recursive: true });
rmSync(join(binDir, "playstoress"), { force: true });
rmSync(join(binDir, "playstoress.cmd"), { force: true });

if (process.platform === "win32") {
  writeFileSync(
    join(binDir, "playstoress.cmd"),
    `@echo off\r\nnode "${target.replace(/\//g, "\\")}" %*\r\n`,
  );
} else {
  const shim = join(binDir, "playstoress");
  writeFileSync(
    shim,
    `#!/bin/sh\nexec node "${target}" "$@"\n`,
  );
  chmodSync(shim, 0o755);
}
