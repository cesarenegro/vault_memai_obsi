#!/usr/bin/env node
import cp from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

console.log(`[a05-generate-corpus.mjs] Generating diverse A05 corpus v2 (Declared Seed: 20260919)...`);

const res = cp.spawnSync('python3', [path.join(ROOT, 'scripts/build_full_dataset.py')], {
  cwd: ROOT,
  stdio: 'inherit'
});

if (res.status !== 0) {
  console.error(`Generation failed with code ${res.status}`);
  process.exit(res.status || 1);
}

console.log(`[a05-generate-corpus.mjs] Successfully generated diverse A05 corpus v2.`);
