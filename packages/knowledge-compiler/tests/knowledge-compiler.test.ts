import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { FrontmatterSchema } from '@limen-vault/vault-schema';
import { KnowledgeCompiler } from '../src/compiler.js';
import { loadCompilerIndex } from '../src/provenance.js';

function createTempVault(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-compiler-test-'));
  fs.mkdirSync(path.join(tmpDir, '20_RAW_SOURCES'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '00_SYSTEM'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '90_PROPOSALS'), { recursive: true });

  const manifestPath = path.join(tmpDir, '00_SYSTEM', 'VAULT_MANIFEST.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      schema_version: 1,
      vault_id: 'test_vault',
      name: 'Test Vault',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    'utf-8'
  );
  return tmpDir;
}

function cleanupTempVault(vaultRoot: string) {
  if (fs.existsSync(vaultRoot)) {
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  }
}

test('KnowledgeCompiler — compiles markdown raw source into 90_PROPOSALS draft with status: draft', async () => {
  const vaultRoot = createTempVault();
  try {
    const rawFileRel = '20_RAW_SOURCES/brand_doc.md';
    const rawFileAbs = path.join(vaultRoot, rawFileRel);
    const originalContent = '# Brand Guidelines\n\nThis is raw brand knowledge.';
    fs.writeFileSync(rawFileAbs, originalContent, 'utf-8');

    const compiler = new KnowledgeCompiler();
    const result = await compiler.compileSourceToDraft(vaultRoot, rawFileRel);

    assert.equal(result.status, 'compiled');
    assert.ok(result.draft_relative_path);
    assert.match(result.draft_relative_path!, /^90_PROPOSALS\/src_.*\.md$/);

    // Verify 20_RAW_SOURCES file is untouched
    assert.equal(fs.readFileSync(rawFileAbs, 'utf-8'), originalContent);

    // Verify draft file content
    const draftAbs = path.join(vaultRoot, result.draft_relative_path);
    assert.ok(fs.existsSync(draftAbs));
    const draftText = fs.readFileSync(draftAbs, 'utf-8');
    assert.ok(draftText.includes('# Brand Guidelines'));

    // Verify frontmatter schema compliance & status: "draft"
    const fmMatch = draftText.match(/^---\n([\s\S]+?)\n---/);
    assert.ok(fmMatch);
    const parsedFm = yaml.load(fmMatch[1]) as any;
    assert.equal(parsedFm.status, 'draft');
    assert.equal(parsedFm.title, 'Brand Guidelines');

    const validatedFm = FrontmatterSchema.parse(parsedFm);
    assert.equal(validatedFm.status, 'draft');

    // Verify provenance index in 00_SYSTEM/COMPILER_INDEX.json
    const index = loadCompilerIndex(vaultRoot);
    assert.ok(index.records['20_RAW_SOURCES/brand_doc.md']);
    assert.ok(index.records['20_RAW_SOURCES/brand_doc.md'].first_compiled_at);
  } finally {
    cleanupTempVault(vaultRoot);
  }
});

test('KnowledgeCompiler — de-duplication skips unchanged source files', async () => {
  const vaultRoot = createTempVault();
  try {
    const rawFileRel = '20_RAW_SOURCES/product_spec.txt';
    const rawFileAbs = path.join(vaultRoot, rawFileRel);
    fs.writeFileSync(rawFileAbs, 'Product spec text content', 'utf-8');

    const compiler = new KnowledgeCompiler();
    const result1 = await compiler.compileSourceToDraft(vaultRoot, rawFileRel);
    assert.equal(result1.status, 'compiled');

    // Second compile on unchanged file
    const result2 = await compiler.compileSourceToDraft(vaultRoot, rawFileRel);
    assert.equal(result2.status, 'unchanged');
    assert.equal(result2.draft_relative_path, result1.draft_relative_path);
  } finally {
    cleanupTempVault(vaultRoot);
  }
});

test('KnowledgeCompiler — HTML sanitization removes scripts and dangerous attributes', async () => {
  const vaultRoot = createTempVault();
  try {
    const rawFileRel = '20_RAW_SOURCES/unsafe_page.html';
    const rawFileAbs = path.join(vaultRoot, rawFileRel);
    const unsafeHtml = `
      <html>
        <head><title>Dangerous Page</title></head>
        <body>
          <script>alert("xss")</script>
          <iframe src="http://malicious.com"></iframe>
          <p onclick="alert('click')">Safe Text Content</p>
          <img src="http://external.com/image.png" />
        </body>
      </html>
    `;
    fs.writeFileSync(rawFileAbs, unsafeHtml, 'utf-8');

    const compiler = new KnowledgeCompiler();
    const result = await compiler.compileSourceToDraft(vaultRoot, rawFileRel);

    assert.equal(result.status, 'compiled');
    const draftAbs = path.join(vaultRoot, result.draft_relative_path!);
    const draftText = fs.readFileSync(draftAbs, 'utf-8');

    assert.ok(!draftText.includes('<script>'));
    assert.ok(!draftText.includes('alert('));
    assert.ok(!draftText.includes('<iframe'));
    assert.ok(!draftText.includes('onclick'));
    assert.ok(!draftText.includes('http://external.com'));
    assert.ok(draftText.includes('Safe Text Content'));
  } finally {
    cleanupTempVault(vaultRoot);
  }
});

test('KnowledgeCompiler — batchCompile aggregates report correctly and handles unsupported files', async () => {
  const vaultRoot = createTempVault();
  try {
    fs.writeFileSync(path.join(vaultRoot, '20_RAW_SOURCES/doc1.md'), '# Doc 1', 'utf-8');
    fs.writeFileSync(path.join(vaultRoot, '20_RAW_SOURCES/doc2.txt'), 'Doc 2 text', 'utf-8');
    fs.writeFileSync(path.join(vaultRoot, '20_RAW_SOURCES/binary.bin'), '\x00\x01\x02', 'utf-8');

    const compiler = new KnowledgeCompiler();
    const batchReport = await compiler.batchCompile(vaultRoot);

    assert.equal(batchReport.compiled_count, 2);
    assert.equal(batchReport.unsupported_count, 1);
    assert.equal(batchReport.error_count, 0);

    // Re-run batch -> 2 unchanged, 1 unsupported
    const batchReport2 = await compiler.batchCompile(vaultRoot);
    assert.equal(batchReport2.compiled_count, 0);
    assert.equal(batchReport2.unchanged_count, 2);
    assert.equal(batchReport2.unsupported_count, 1);
  } finally {
    cleanupTempVault(vaultRoot);
  }
});

test('M4 preserves human revisions and separates identical basenames and case',async()=>{
 const v=createTempVault(); const c=new KnowledgeCompiler();
 try{
  for(const d of ['a','b'])fs.mkdirSync(path.join(v,'20_RAW_SOURCES',d));
  const rel='20_RAW_SOURCES/a/doc.md';fs.writeFileSync(path.join(v,rel),'# Title C:\\draft\nfirst');
  const a=await c.compileSourceToDraft(v,rel);assert.equal(a.status,'compiled');
  const draft=path.join(v,a.draft_relative_path!);const human=fs.readFileSync(draft,'utf8')+'\nHUMAN EDIT';fs.writeFileSync(draft,human);
  assert.equal((await c.compileSourceToDraft(v,rel)).status,'unchanged');
  fs.writeFileSync(path.join(v,rel),'# Revision\nsecond');const b=await c.compileSourceToDraft(v,rel);
  assert.equal(b.status,'compiled');assert.notEqual(a.draft_relative_path,b.draft_relative_path);assert.equal(fs.readFileSync(draft,'utf8'),human);
  fs.writeFileSync(path.join(v,'20_RAW_SOURCES/b/doc.md'),'# Collision');const collision=await c.compileSourceToDraft(v,'20_RAW_SOURCES/b/doc.md');
  assert.equal(collision.status,'compiled');assert.notEqual(collision.draft_relative_path,b.draft_relative_path);
  const fm=yaml.load(fs.readFileSync(draft,'utf8').split('---\n')[1]) as any;assert.equal(fm.title,'Title C:\\draft');
 }finally{cleanupTempVault(v);}
});

test('M4 refuses symlinks, non-raw inputs, malformed index and occupied lock without writes',async()=>{
 const v=createTempVault(),external=fs.mkdtempSync(path.join(os.tmpdir(),'m4-external-'));const c=new KnowledgeCompiler();
 try{
  const rel='20_RAW_SOURCES/doc.md';fs.writeFileSync(path.join(v,rel),'# Good');
  fs.writeFileSync(path.join(v,'00_SYSTEM/source.md'),'# Outside RAW');assert.equal((await c.compileSourceToDraft(v,'00_SYSTEM/source.md')).status,'error');
  fs.rmdirSync(path.join(v,'90_PROPOSALS'));fs.symlinkSync(external,path.join(v,'90_PROPOSALS'));
  assert.equal((await c.compileSourceToDraft(v,rel)).status,'error');assert.deepEqual(fs.readdirSync(external),[]);
  fs.unlinkSync(path.join(v,'90_PROPOSALS'));fs.mkdirSync(path.join(v,'90_PROPOSALS'));
  fs.symlinkSync(path.join(v,rel),path.join(v,'20_RAW_SOURCES/link.md'));assert.equal((await c.compileSourceToDraft(v,'20_RAW_SOURCES/link.md')).status,'error');
  const index=path.join(v,'00_SYSTEM/COMPILER_INDEX.json');fs.writeFileSync(index,'{bad');assert.equal((await c.compileSourceToDraft(v,rel)).status,'error');assert.equal(fs.readFileSync(index,'utf8'),'{bad');fs.unlinkSync(index);
  fs.mkdirSync(path.join(v,'00_SYSTEM/.compiler-lock'));assert.equal((await c.compileSourceToDraft(v,rel)).status,'error');assert.ok(fs.existsSync(path.join(v,'00_SYSTEM/.compiler-lock')));fs.rmdirSync(path.join(v,'00_SYSTEM/.compiler-lock'));
  assert.deepEqual(fs.readdirSync(path.join(v,'90_PROPOSALS')),[]);
 }finally{cleanupTempVault(v);fs.rmSync(external,{recursive:true,force:true});}
});

test('M4 batch continues after per-source failures and leaves no partial files',async()=>{
 const v=createTempVault();try{
  fs.writeFileSync(path.join(v,'20_RAW_SOURCES/good.md'),'# Good');fs.writeFileSync(path.join(v,'20_RAW_SOURCES/invalid.txt'),Buffer.from([0xff]));
  fs.symlinkSync('/nonexistent-m4-fixture',path.join(v,'20_RAW_SOURCES/link.md'));
  const r=await new KnowledgeCompiler().batchCompile(v);assert.equal(r.compiled_count,1);assert.equal(r.error_count,2);
  assert.ok(!fs.readdirSync(path.join(v,'00_SYSTEM')).some(n=>n.startsWith('.compiler')));
  assert.ok(!fs.readdirSync(path.join(v,'90_PROPOSALS')).some(n=>n.startsWith('.compiler')));
 }finally{cleanupTempVault(v);}
});
