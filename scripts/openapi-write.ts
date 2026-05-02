import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { generateOpenApiSpec } from "@/lib/api/openapi";

const target = process.argv[2] ?? ".openapi/spec.json";
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(generateOpenApiSpec(), null, 2));
console.log(`Wrote ${target}`);
