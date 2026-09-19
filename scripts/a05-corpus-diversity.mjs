#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CORPUS_DIR = path.join(ROOT, 'tests/gold/A05_CORPUS');

export const ITALIAN_STOPWORDS = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'del', 'dello', 'della', 'dei', 'degli', 'delle',
  'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
  'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
  'col', 'coi', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
  'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
  'e', 'ed', 'o', 'od', 'ma', 'se', 'che', 'chi', 'cui', 'non',
  'piu', 'meno', 'come', 'dove', 'quando', 'quale', 'quali',
  'quanto', 'quanti', 'quanta', 'quante',
  'questo', 'questa', 'questi', 'queste',
  'quello', 'quella', 'quelli', 'quelle',
  'suo', 'sua', 'suoi', 'sue', 'loro',
  'nostro', 'nostra', 'nostri', 'nostre',
  'vostro', 'vostra', 'vostri', 'vostre',
  'mio', 'mia', 'miei', 'mie',
  'tuo', 'tua', 'tuoi', 'tue',
  'anche', 'gia', 'cosi', 'solo', 'tutto', 'tutti', 'tutta', 'tutte',
  'molto', 'molti', 'molta', 'molte', 'poco', 'pochi', 'poca', 'poche',
  'essere', 'stato', 'stati', 'stata', 'state', 'sono', 'sei', 'era', 'erano',
  'sara', 'sarebbe', 'sia', 'siano',
  'fare', 'fatto', 'fatta', 'fatti', 'fatte', 'fa', 'fanno', 'faceva',
  'avere', 'ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'aveva', 'avevano',
  'ad', 'ci', 'vi', 'ne', 'si', 'mi', 'ti', 'li',
  'ogni', 'alcuni', 'alcune', 'alcuno', 'alcuna', 'senza', 'dopo', 'prima',
  'sopra', 'sotto', 'dentro', 'fuori', 'verso', 'contro', 'mediante', 'durante'
]);

function normalizeContent(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !/^\d+$/.test(t) && !ITALIAN_STOPWORDS.has(t));
}

function computeJaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionCount++;
  }
  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

function runDiversityCheck() {
  console.log(`=== A05 Corpus Diversity Check (Jaccard Pairwise Analysis) ===\n`);
  if (!fs.existsSync(CORPUS_DIR)) {
    console.error(`Corpus directory not found: ${CORPUS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CORPUS_DIR).filter(f => f.endsWith('.md')).sort();
  console.log(`Total documents found: ${files.length}`);
  if (files.length < 120) {
    console.error(`Error: expected at least 120 documents, found ${files.length}`);
    process.exit(1);
  }

  const docTokens = new Map();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(CORPUS_DIR, file), 'utf8');
    const tokens = new Set(normalizeContent(raw));
    docTokens.set(file, tokens);
  }

  let totalPairs = 0;
  let maxJaccard = 0;
  let maxPair = null;
  let sumJaccard = 0;
  const violations = [];
  const THRESHOLD = 0.30;

  for (let i = 0; i < files.length; i++) {
    const fileA = files[i];
    const tokensA = docTokens.get(fileA);
    for (let j = i + 1; j < files.length; j++) {
      const fileB = files[j];
      const tokensB = docTokens.get(fileB);
      const jaccard = computeJaccard(tokensA, tokensB);
      totalPairs++;
      sumJaccard += jaccard;
      if (jaccard > maxJaccard) {
        maxJaccard = jaccard;
        maxPair = [fileA, fileB, jaccard];
      }
      if (jaccard > THRESHOLD) {
        violations.push({ fileA, fileB, jaccard });
      }
    }
  }

  const avgJaccard = totalPairs > 0 ? sumJaccard / totalPairs : 0;
  console.log(`Total pairs analyzed: ${totalPairs}`);
  console.log(`Average Jaccard similarity: ${avgJaccard.toFixed(4)}`);
  console.log(`Maximum Jaccard similarity: ${maxJaccard.toFixed(4)} between ${maxPair ? maxPair[0] : 'N/A'} and ${maxPair ? maxPair[1] : 'N/A'}`);
  console.log(`Threshold: ${THRESHOLD.toFixed(2)}`);

  if (violations.length > 0) {
    console.error(`\n❌ FAILED: ${violations.length} pairs exceeded Jaccard threshold ${THRESHOLD.toFixed(2)}:`);
    for (const v of violations.slice(0, 10)) {
      console.error(`  - ${v.fileA} <-> ${v.fileB}: Jaccard = ${v.jaccard.toFixed(4)}`);
    }
    if (violations.length > 10) {
      console.error(`  ... and ${violations.length - 10} more pairs.`);
    }
    process.exit(1);
  }

  console.log(`\n✅ [PASS] All ${totalPairs} document pairs have Jaccard similarity <= ${THRESHOLD.toFixed(2)}.`);
  console.log(`The corpus satisfies the diversity requirement with zero boilerplate repetition.`);
}

runDiversityCheck();
