#!/usr/bin/env node
// Measures gzipped JS size of route-specific chunks and fails CI if any page exceeds BUDGET_KB_GZ.
// Reads .next/app-build-manifest.json (App Router page → chunk mapping) and sums gz sizes.
// Exits 0 (skip) when the manifest is absent — use ANALYZE=true pnpm build to inspect manually.
import { readFileSync } from "fs";
import { join } from "path";
import { gzipSync } from "zlib";

const BUDGET_KB = Number(process.env.BUDGET_KB_GZ ?? "150");
const NEXT_DIR = ".next";

function gzSize(filePath) {
  try {
    return gzipSync(readFileSync(filePath), { level: 9 }).length;
  } catch {
    return 0;
  }
}

function checkPagesFromManifest() {
  const manifestPath = join(NEXT_DIR, "app-build-manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }

  const PAGES_OF_INTEREST = {
    "Home (/)": ["/pt/page", "/page", "/pt"],
    "Service (/pt/servico/[slug])": ["/pt/servico/[slug]/page", "/servico/[slug]/page"],
  };

  let failed = false;
  for (const [label, candidates] of Object.entries(PAGES_OF_INTEREST)) {
    const chunks = candidates.flatMap((c) => manifest.pages?.[c] ?? []);
    if (chunks.length === 0) {
      console.log(`ℹ  ${label}: no chunks found in manifest, skipping`);
      continue;
    }
    const totalBytes = chunks.reduce((sum, chunk) => {
      const p = join(NEXT_DIR, chunk);
      return sum + gzSize(p);
    }, 0);
    const kb = (totalBytes / 1024).toFixed(1);
    const over = totalBytes > BUDGET_KB * 1024;
    console.log(`${over ? "❌" : "✅"} ${label}: ${kb} KB gz (budget: ${BUDGET_KB} KB)`);
    if (over) failed = true;
  }
  return failed;
}

const manifestResult = checkPagesFromManifest();

if (manifestResult === null) {
  console.log(
    "ℹ  app-build-manifest.json not found — per-page budget check skipped.\n" +
      "  Run ANALYZE=true pnpm build to inspect chunk sizes manually.",
  );
  process.exit(0);
}

if (manifestResult) {
  console.error(
    "\nBundle budget exceeded. Reduce dependencies, enable lazy loading, or adjust BUDGET_KB_GZ.",
  );
  process.exit(1);
}

console.log("\nBundle budget OK.");
