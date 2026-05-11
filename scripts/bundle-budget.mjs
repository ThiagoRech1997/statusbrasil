#!/usr/bin/env node
// Measures gzipped JS size of all page chunks and fails CI if any page exceeds BUDGET_KB_GZ.
// Reads .next/app-build-manifest.json (App Router page → chunk mapping) and sums gz sizes.
// Falls back to measuring the total .next/static/chunks/ footprint if the manifest is absent.
import { readdirSync, readFileSync, statSync } from "fs";
import { extname, join } from "path";
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

function checkTotalChunks() {
  const chunksDir = join(NEXT_DIR, "static", "chunks");
  let total = 0;
  let count = 0;
  for (const entry of readdirSync(chunksDir, { recursive: true })) {
    if (extname(String(entry)) !== ".js") continue;
    const p = join(chunksDir, String(entry));
    if (!statSync(p).isFile()) continue;
    total += gzSize(p);
    count++;
  }
  const kb = (total / 1024).toFixed(1);
  const over = total > BUDGET_KB * 1024;
  console.log(
    `${over ? "❌" : "✅"} Total JS chunks (${count} files): ${kb} KB gz (budget: ${BUDGET_KB} KB)`,
  );
  return over;
}

const manifestResult = checkPagesFromManifest();
const failed = manifestResult === null ? checkTotalChunks() : manifestResult;

if (failed) {
  console.error(
    "\nBundle budget exceeded. Reduce dependencies, enable lazy loading, or adjust BUDGET_KB_GZ.",
  );
  process.exit(1);
}

console.log("\nBundle budget OK.");
