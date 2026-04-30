#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const ptPath = resolve(root, "messages/pt.json");
const enPath = resolve(root, "messages/en.json");

const pt = JSON.parse(readFileSync(ptPath, "utf8"));
const en = JSON.parse(readFileSync(enPath, "utf8"));

function leafPaths(node, prefix = "") {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return [prefix];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    leafPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

const ptKeys = new Set(leafPaths(pt));
const enKeys = new Set(leafPaths(en));

const missingInEn = [...ptKeys].filter((k) => !enKeys.has(k)).sort();
const missingInPt = [...enKeys].filter((k) => !ptKeys.has(k)).sort();

if (missingInEn.length === 0 && missingInPt.length === 0) {
  console.log("i18n parity OK: messages/pt.json and messages/en.json have identical key structure");
  process.exit(0);
}

console.error("i18n drift detected between messages/pt.json and messages/en.json");
if (missingInEn.length > 0) {
  console.error("\nKeys in pt.json missing from en.json:");
  for (const k of missingInEn) console.error(`  - ${k}`);
}
if (missingInPt.length > 0) {
  console.error("\nKeys in en.json missing from pt.json:");
  for (const k of missingInPt) console.error(`  - ${k}`);
}
process.exit(1);
