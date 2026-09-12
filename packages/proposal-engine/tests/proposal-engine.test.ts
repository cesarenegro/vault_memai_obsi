import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { saveAIOutput, listAIOutputs } from '../src/ai-output-store.js';
import { createProposal, listProposals, getProposal, updateProposalRevision, rejectProposal } from '../src/proposal-engine.js';
import { approveProposal } from '../src/approver.js';
import { loadProposalIndex } from '../src/proposal-store.js';
import { sanitizeVaultPath } from '../src/path-safety.js';

function createTempVault(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-proposal-test-'));
  fs.mkdirSync(path.join(tmpDir, '00_SYSTEM'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '01_CLIENTS'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '20_RAW_SOURCES'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '80_AI_OUTPUTS'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '90_PROPOSALS'), { recursive: true });

  fs.writeFileSync(
    path.join(tmpDir, '00_SYSTEM', 'VAULT_MANIFEST.json'),
    JSON.stringify({
      schema_version: 1,
      vault_id: 'test_vault',
      name: 'Test Proposal Vault',
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

test('AI Output Store — saves AI response into 80_AI_OUTPUTS with draft frontmatter and redacts keys', async () => {
  const vaultRoot = createTempVault();
  try {
    const prompt = 'Tell me about Acme with sk-1234567890abcdef12345678';
    const response = 'Acme is a client.';
    const output = await saveAIOutput(vaultRoot, prompt, response, 'openai', 'gpt-4o', [
      { documentId: 'doc_1', relativePath: '01_CLIENTS/acme.md', title: 'Acme', category: 'client' },
    ]);

    assert.ok(output.relativePath.startsWith('80_AI_OUTPUTS/'));
    assert.ok(fs.existsSync(path.join(vaultRoot, output.relativePath)));

    const fileContent = fs.readFileSync(path.join(vaultRoot, output.relativePath), 'utf-8');
    assert.ok(fileContent.includes('status: "draft"'));
    assert.ok(fileContent.includes('[REDACTED_API_KEY]'));
    assert.ok(!fileContent.includes('sk-1234567890'));

    const list = await listAIOutputs(vaultRoot);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, output.id);

    // Verify raw sources and approved folders are not written to
    const rawFiles = fs.readdirSync(path.join(vaultRoot, '20_RAW_SOURCES'));
    assert.equal(rawFiles.length, 0);
  } finally {
    cleanupTempVault(vaultRoot);
  }
});

test('Proposal Engine — creates, lists, updates revisions, and rejects candidate proposals', async () => {
  const vaultRoot = createTempVault();
  try {
    const proposal = await createProposal(vaultRoot, {
      title: 'Acme Marketing Strategy',
      category: 'client',
      content: 'Initial proposal body content.',
      client: 'Acme',
    });

    assert.equal(proposal.revision, 1);
    assert.equal(proposal.frontmatterStatus, 'draft');
    assert.equal(proposal.workflowStatus, 'pending');
    assert.ok(proposal.relativePath.startsWith('90_PROPOSALS/'));

    // Check disk content
    const diskContent = fs.readFileSync(path.join(vaultRoot, proposal.relativePath), 'utf-8');
    assert.ok(diskContent.includes('status: "draft"'));
    assert.ok(diskContent.includes('Initial proposal body content.'));

    // Update revision
    const rev2 = await updateProposalRevision(
      vaultRoot,
      proposal.id,
      `---\ntitle: Acme Marketing Strategy\ntype: client\nclient: Acme\n---\n# Acme Marketing Strategy\nUpdated revision 2 content.`,
      'Refined strategy text'
    );

    assert.equal(rev2.revision, 2);
    assert.equal(rev2.revisionsHistory.length, 2);
    assert.ok(rev2.markdown.includes('Updated revision 2 content.'));

    // Reject proposal
    const rejected = await rejectProposal(vaultRoot, proposal.id, 'Strategy rejected by reviewer');
    assert.equal(rejected.workflowStatus, 'rejected');
    assert.equal(rejected.rejectionReason, 'Strategy rejected by reviewer');

    // Original candidate file must be preserved
    assert.ok(fs.existsSync(path.join(vaultRoot, proposal.relativePath)));
  } finally {
    cleanupTempVault(vaultRoot);
  }
});

test('Approver — human approval publishes proposal into approved category with status: approved and byte verification', async () => {
  const vaultRoot = createTempVault();
  try {
    // Put raw file in 20_RAW_SOURCES to verify immutability
    const rawPath = path.join(vaultRoot, '20_RAW_SOURCES/raw_spec.md');
    fs.writeFileSync(rawPath, '# Immutable Raw Spec', 'utf-8');
    const rawStatBefore = fs.statSync(rawPath);

    const proposal = await createProposal(vaultRoot, {
      title: 'Brand Positioning Proposal',
      category: 'client',
      content: 'Approved candidate text for client brand positioning.',
      client: 'BrandCorp',
    });

    // 1. Human Approval with valid expected SHA256
    const approvalRes = await approveProposal(vaultRoot, {
      proposalId: proposal.id,
      revision: proposal.revision,
      expectedSha256: proposal.sha256,
      decision: 'approve',
      targetCategory: 'client',
    });

    assert.equal(approvalRes.success, true);
    assert.ok(approvalRes.targetRelativePath);
    assert.equal(approvalRes.targetRelativePath, '01_CLIENTS/brand_positioning.md');

    // Check published file content & status: "approved"
    const publishedAbs = path.join(vaultRoot, approvalRes.targetRelativePath);
    assert.ok(fs.existsSync(publishedAbs));
    const publishedText = fs.readFileSync(publishedAbs, 'utf-8');
    assert.ok(publishedText.includes('status: "approved"'));
    assert.ok(publishedText.includes('Approved candidate text for client brand positioning.'));

    // Verify proposal workflow status updated in index
    const index = loadProposalIndex(vaultRoot);
    assert.equal(index.proposals[proposal.id].workflowStatus, 'approved');

    // Verify 20_RAW_SOURCES file is untouched (immutability invariant)
    const rawStatAfter = fs.statSync(rawPath);
    assert.equal(rawStatBefore.mtimeMs, rawStatAfter.mtimeMs);
    assert.equal(fs.readFileSync(rawPath, 'utf-8'), '# Immutable Raw Spec');
  } finally {
    cleanupTempVault(vaultRoot);
  }
});

test('Approver — detects byte conflict mismatch and target collisions', async () => {
  const vaultRoot = createTempVault();
  try {
    const proposal = await createProposal(vaultRoot, {
      title: 'Conflict Test Proposal',
      category: 'client',
      content: 'Original content.',
    });

    // 1. SHA256 mismatch conflict detection
    const conflictRes = await approveProposal(vaultRoot, {
      proposalId: proposal.id,
      revision: 1,
      expectedSha256: 'wrong_sha256_hash_value_12345',
      decision: 'approve',
    });

    assert.equal(conflictRes.success, false);
    assert.equal(conflictRes.conflictDetected, true);
    assert.ok(conflictRes.error?.includes('Conflict detected'));

    // 2. Target collision check: create target document first
    const targetPath = path.join(vaultRoot, '01_CLIENTS/conflict_test.md');
    fs.writeFileSync(targetPath, '# Existing Approved Note', 'utf-8');

    const collisionRes = await approveProposal(vaultRoot, {
      proposalId: proposal.id,
      revision: 1,
      expectedSha256: proposal.sha256,
      decision: 'approve',
      targetRelativePath: '01_CLIENTS/conflict_test.md',
      allowOverwrite: false,
    });

    assert.equal(collisionRes.success, false);
    assert.equal(collisionRes.conflictDetected, true);
    assert.ok(collisionRes.error?.includes('Silent overwrite is forbidden'));

    // 3. Security path traversal check
    assert.throws(
      () => {
        sanitizeVaultPath(vaultRoot, '../../etc/passwd');
      },
      { message: /SecurityPathError/ }
    );
  } finally {
    cleanupTempVault(vaultRoot);
  }
});

test('Approval rejects RAW destinations, missing hash, stale revision and rejected decision', async () => {
  const v=createTempVault();
  try {
    const p=await createProposal(v,{title:'Boundary',category:'client',content:'Candidate'});
    const base={proposalId:p.id,revision:p.revision,expectedSha256:p.sha256,decision:'approve' as const};
    for(const override of [{targetRelativePath:'20_RAW_SOURCES/forbidden.md'},{expectedSha256:''},{revision:99},{decision:'reject' as const}]) {
      assert.equal((await approveProposal(v,{...base,...override})).success,false);
    }
    assert.equal(fs.readdirSync(path.join(v,'20_RAW_SOURCES')).length,0);
    assert.equal(fs.readdirSync(path.join(v,'01_CLIENTS')).length,0);
  } finally {cleanupTempVault(v);}
});

test('Corrupt proposal index is rejected and preserved rather than reset silently', async () => {
  const v=createTempVault();
  try {
    const f=path.join(v,'00_SYSTEM/PROPOSAL_INDEX.json');fs.writeFileSync(f,'{broken');
    assert.throws(()=>loadProposalIndex(v));assert.equal(fs.readFileSync(f,'utf8'),'{broken');
  } finally {cleanupTempVault(v);}
});
