import { execFileSync } from "node:child_process";
import { rmSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));   // scripts/
const root = resolve(here, "..");                        // repo root
const db      = resolve(root, "src/assets/wordnet.sqlite");
const archive = resolve(root, "src/assets/wordnet.7z");

// Skip packing if the archive already exists.
if (existsSync(archive)) {
    const { size } = statSync(archive);
    console.log(`skipping pack: ${archive} already exists (${(size / 1e6).toFixed(1)} MB)`);
    process.exit(0);
}

if (!existsSync(db)) {
    console.error(`error: DB not found at ${db}`);
    console.error(`       run the loader first, or check your layout.`);
    process.exit(1);
}

console.log(`packing ${db} -> ${archive}`);
execFileSync(
    "7z",
    ["a", "-mx=9", "-y", "-bso0", "-bsp0", archive, db],
    { stdio: "inherit" }
);

const { size } = statSync(archive);
console.log(`packed: ${archive} (${(size / 1e6).toFixed(1)} MB)`);
