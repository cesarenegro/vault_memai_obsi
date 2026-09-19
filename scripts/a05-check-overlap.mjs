#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const QUERIES_PATH = path.join(ROOT, 'tests/gold/A05_QUERIES.json');
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
  'sara', 'sarebbe', 'sia', 'siano', 'stato',
  'fare', 'fatto', 'fatta', 'fatti', 'fatte', 'fa', 'fanno', 'faceva',
  'avere', 'ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'aveva', 'avevano',
  'ad', 'ci', 'vi', 'ne', 'si', 'mi', 'ti', 'ci', 'vi', 'li', 'le',
  'ogni', 'alcuni', 'alcune', 'alcuno', 'alcuna', 'senza', 'dopo', 'prima',
  'sopra', 'sotto', 'dentro', 'fuori', 'verso', 'contro', 'mediante', 'durante'
]);

export function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s]/g, ' ');   // punctuation to space
}

export function extractContentWords(text) {
  const norm = normalizeText(text);
  const tokens = norm.split(/\s+/).filter(t => t.length >= 3);
  return tokens.filter(t => !ITALIAN_STOPWORDS.has(t));
}

export function checkOverlap() {
  if (!fs.existsSync(QUERIES_PATH)) {
    console.error(`Queries file missing: ${QUERIES_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(CORPUS_DIR)) {
    console.error(`Corpus directory missing: ${CORPUS_DIR}`);
    process.exit(1);
  }

  const queries = JSON.parse(fs.readFileSync(QUERIES_PATH, 'utf8'));
  console.log(`=== A05 Non-Overlap Check: ${queries.length} queries against target passages ===\n`);

  let totalQueries = queries.length;
  let passedCount = 0;
  let failedCount = 0;
  const failures = [];

  for (const q of queries) {
    const queryContentWords = new Set(extractContentWords(q.text));
    let queryFailed = false;
    const overlapDetails = [];

    for (const docId of q.relevantDocumentIds) {
      // Find file in corpus
      const docFile = path.join(CORPUS_DIR, `${docId}.md`);
      if (!fs.existsSync(docFile)) {
        console.error(`Document file not found: ${docFile}`);
        process.exit(1);
      }
      const docRaw = fs.readFileSync(docFile, 'utf8');

      // If relevantPassageIds or locator specified, check against relevant section or target passage
      let targetText = docRaw;
      if (q.relevantTargetExcerpt) {
        targetText = q.relevantTargetExcerpt;
      }

      const passageWords = new Set(extractContentWords(targetText));
      const overlap = [...queryContentWords].filter(w => passageWords.has(w));

      if (overlap.length > 0) {
        queryFailed = true;
        overlapDetails.push({ docId, overlap });
      }
    }

    if (queryFailed) {
      failedCount++;
      failures.push({
        queryId: q.queryId,
        queryText: q.text,
        details: overlapDetails
      });
      console.log(`❌ [FAIL] ${q.queryId}: Overlap detected!`);
      for (const d of overlapDetails) {
        console.log(`    Doc ${d.docId}: overlapping terms -> [${d.overlap.join(', ')}]`);
      }
    } else {
      passedCount++;
      console.log(`✅ [PASS] ${q.queryId}: 0 overlapping content words`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`Total queries checked: ${totalQueries}`);
  console.log(`Passed (zero lexical overlap): ${passedCount}`);
  console.log(`Failed (overlap detected):     ${failedCount}`);
  console.log(`======================================================\n`);

  if (failedCount > 0) {
    console.error(`Check FAILED with ${failedCount} overlapping queries.`);
    process.exit(1);
  } else {
    console.log(`All ${passedCount} queries strictly satisfy the zero-content-overlap constraint.`);
    process.exit(0);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkOverlap();
}
