import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { VaultManager } from '@limen-vault/vault-core';
import {
  ManifestVerifier,
  SnapshotManager,
  SnapshotAlreadyExistsError,
  SnapshotCreationError,
  computeFileSHA256,
} from '../src/index.js';

function runSnapshotEngineTests() {
  console.log('🧪 Running Snapshot Engine Unit Test Suite (Milestone M3)...');
  const testTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-vault-m3-test-'));

  try {
    const vaultPath = path.join(testTmpDir, 'TestVaultM3');
    VaultManager.createVault(vaultPath, 'Test Vault M3');

    // 1. Initial Manifest Integrity Verification
    const initialReport = ManifestVerifier.verifyIntegrity(vaultPath);
    if (!initialReport.isIntegrityValid) {
      console.error('Initial report details:', JSON.stringify(initialReport, null, 2));
    }
    assert.strictEqual(initialReport.isIntegrityValid, true, 'Initial vault manifest integrity should be valid');
    assert.strictEqual(initialReport.modifiedFiles.length, 0);
    assert.strictEqual(initialReport.missingFiles.length, 0);
    assert.strictEqual(initialReport.addedFiles.length, 0);
    console.log('  ✅ 1. Initial vault manifest integrity verification passed');

    // 2. Snapshot Creation & List Verification
    const snap1 = SnapshotManager.createSnapshot(vaultPath, 'Initial Snapshot Version');
    assert.ok(snap1.id.startsWith('snap-'), 'Snapshot ID should start with snap-');
    assert.strictEqual(snap1.integrityStatus, 'valid');

    const list1 = SnapshotManager.listSnapshots(vaultPath);
    assert.strictEqual(list1.length, 1);
    assert.strictEqual(list1[0].id, snap1.id);

    const snap1Report = SnapshotManager.verifySnapshotIntegrity(vaultPath, snap1.id);
    assert.strictEqual(snap1Report.isIntegrityValid, true, 'Snapshot 1 integrity must be valid');
    console.log('  ✅ 2. Versioned local snapshot creation and verification passed');

    // 3. Successive Version Creation without Altering Previous Ones
    // Wait brief moment to guarantee distinct timestamp
    const snap2 = SnapshotManager.createSnapshot(vaultPath, 'Second Snapshot Version');
    const list2 = SnapshotManager.listSnapshots(vaultPath);
    assert.strictEqual(list2.length, 2, 'Should list 2 versioned snapshots');

    const snap1ReportAfter = SnapshotManager.verifySnapshotIntegrity(vaultPath, snap1.id);
    assert.strictEqual(snap1ReportAfter.isIntegrityValid, true, 'Snapshot 1 must remain intact after Snapshot 2 creation');
    console.log('  ✅ 3. Successive versioning without altering previous snapshots passed');

    // 4. Detection of Modified, Missing, and Added Files
    const testFile = path.join(vaultPath, '01_CLIENTS', 'test_client.md');
    fs.writeFileSync(testFile, '---\nid: test\ntitle: Test\ntype: client\ncreated_at: "2026-09-11"\nupdated_at: "2026-09-11"\n---\n# Test Client', 'utf8');

    // Added file check
    const addedReport = ManifestVerifier.verifyIntegrity(vaultPath);
    assert.strictEqual(addedReport.isIntegrityValid, false, 'Integrity should fail when unmanifested file added');
    assert.strictEqual(addedReport.addedFiles.length, 1);
    assert.ok(addedReport.addedFiles.includes('01_CLIENTS/test_client.md'));
    console.log('  ✅ 4a. Added file detection passed');

    // Modify existing file
    const homeFile = path.join(vaultPath, '00_SYSTEM', 'HOME.md');
    const originalHomeContent = fs.readFileSync(homeFile, 'utf8');
    fs.writeFileSync(homeFile, originalHomeContent + '\n<!-- Modified for test -->', 'utf8');

    const modifiedReport = ManifestVerifier.verifyIntegrity(vaultPath);
    assert.ok(modifiedReport.modifiedFiles.includes('00_SYSTEM/HOME.md'), 'Should detect modified HOME.md');
    console.log('  ✅ 4b. Modified file detection passed');

    // Missing file check
    fs.rmSync(homeFile);
    const missingReport = ManifestVerifier.verifyIntegrity(vaultPath);
    assert.ok(missingReport.missingFiles.includes('00_SYSTEM/HOME.md'), 'Should detect missing HOME.md');
    console.log('  ✅ 4c. Missing file detection passed');

    // Restore homeFile & remove testFile for clean state
    fs.writeFileSync(homeFile, originalHomeContent, 'utf8');
    fs.rmSync(testFile);

    // 5. Anti-Recursion & Vault Preservation Check
    // Verify SNAPSHOTS folder is NOT copied inside snapshots
    const snapshotsDirInSnap1 = path.join(snap1.snapshotPath, '00_SYSTEM', 'SNAPSHOTS');
    assert.strictEqual(fs.existsSync(snapshotsDirInSnap1), false, 'Snapshot must not recursively copy 00_SYSTEM/SNAPSHOTS');
    console.log('  ✅ 5. Anti-recursion protection passed');

    // 6. Regression Check for M2 Vault Core
    const openRes = VaultManager.openVault(vaultPath);
    assert.strictEqual(openRes.status.state, 'READY');
    assert.strictEqual(openRes.validation.isValid, true);
    console.log('  ✅ 6. Milestone M2 Vault Core regression test passed');

    console.log('🎉 All Snapshot Engine unit tests passed cleanly!');
  } finally {
    if (fs.existsSync(testTmpDir)) {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    }
  }
}

runSnapshotEngineTests();
