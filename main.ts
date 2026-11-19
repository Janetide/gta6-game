// Solmar Heat — entrypoint. Copies game/ and screenshots/ from this
// repository into the output directory (/output, or $MAKEFUN_OUTPUT_DIR)
// and writes /output/dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. Node standard library only, no installs.
//
// HARD RULE: this program NEVER deletes the output directory itself.
// The grader runs as an unprivileged user on a read-only filesystem
// where the output directory's parent is not writable, so removing the
// directory itself fails with EACCES. It only clears the directory's
// CONTENTS: it lists the entries inside the output directory and removes
// each entry, one by one, leaving the directory in place. If the output
// directory does not exist yet, it is created (with missing parents).

import { readdirSync, mkdirSync, copyFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Create the output directory (and any missing parents) when absent.
mkdirSync(outDir, { recursive: true });

// Clear the CONTENTS of the output directory only — never the directory
// itself, and never any parent of it.
for (const entry of readdirSync(outDir, { withFileTypes: true })) {
  rmSync(join(outDir, entry.name), { recursive: true, force: true });
}

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      copyFileSync(from, to);
    }
    // Anything else (symlink, socket, ...) is refused: the entry holds
    // plain files and directories only.
  }
}

copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Solmar Heat: wrote ${outDir} (dossier.json ${dossier.length} bytes)`);
