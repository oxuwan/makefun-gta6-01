// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. Only the plumbing, not an open world: Block
// Dodger, a plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a
// title screen, score, lives and levels, game over and restart, flat colours and no sound. Build
// your own open-world crime game in its place (three.js or any library you vendor under game/),
// put your 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Porto Verde entry: the game in game/ is a hand-built open-world crime game (see README.md).
const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Validate what was just written, so a bad build fails loudly here instead of at the gate:
// the dossier must exist and be non-empty, every screenshot must be present,
// and the game's entry point must exist and fit the gate's 1 MiB cap.
const dossierBytes = statSync(dossierPath).size;
if (dossierBytes === 0) throw new Error('dossier.json came out empty');
const indexBytes = statSync(join(out, 'game', 'index.html')).size;
if (indexBytes === 0 || indexBytes > 1048576) {
  throw new Error(`game/index.html is ${indexBytes} bytes, expected 1..1048576`);
}
const shotFiles = readdirSync(join(out, 'screenshots')).filter((name) => !name.startsWith('.'));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shotFiles.length}`);
}
// Output summary: what the entry actually contains, for the build log.
const gameFiles = readdirSync(join(out, 'game'), { recursive: true });
const srcFiles = gameFiles.filter((name) => typeof name === 'string' && name.endsWith('.js'));
console.log(`Porto Verde entry written to ${out}: dossier.json ${dossierBytes} bytes, ${shotFiles.length} screenshots.`);
console.log(`  game/: ${gameFiles.length} entries, ${srcFiles.length} source files (${srcFiles.join(', ')}).`);
