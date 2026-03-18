/**
 * Compiles JSON source files into Foundry VTT v12 LevelDB compendium packs.
 * Bypasses the fvtt CLI and writes directly via classic-level.
 *
 * Run from the system root: node scripts/build-packs.mjs
 */

import { ClassicLevel } from "classic-level";
import { readFileSync, readdirSync, rmSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function packDirectory(sourceDir, outDir, packName) {
  // Read all JSON source files
  const files = readdirSync(sourceDir).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    console.error(`  ✗ No JSON files found in ${sourceDir}`);
    return;
  }

  // Wipe and recreate the output directory so we get a fresh DB
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const db = new ClassicLevel(outDir, { keyEncoding: "utf8", valueEncoding: "json" });

  try {
    const batch = db.batch();
    let count = 0;

    for (const file of files) {
      const raw = readFileSync(join(sourceDir, file), "utf8");
      const doc = JSON.parse(raw);

      if (!doc._id) {
        console.warn(`  ⚠ Skipping ${file} — missing _id field`);
        continue;
      }

      // Foundry LevelDB key format: "!items!<_id>"  (pack type determines prefix)
      // For Item packs the key is "!items!<_id>"
      batch.put(`!items!${doc._id}`, doc);
      count++;
    }

    await batch.write();
    console.log(`  ✓ ${packName}: wrote ${count} documents → ${outDir}`);
  } finally {
    await db.close();
  }
}

(async () => {
  console.log("Building compendium packs...\n");

  await packDirectory(
    join(root, "src/packs/skills"),
    join(root, "packs/skills/skills"),
    "TTXWorks Skills"
  );

  await packDirectory(
    join(root, "src/packs/assets"),
    join(root, "packs/assets/assets"),
    "TTXWorks Assets"
  );

  console.log("\nDone.");
})();
