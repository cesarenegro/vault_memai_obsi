import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  VaultManager,
  VaultCreator,
  VaultValidator,
  VaultAlreadyExistsError,
  SecurityPathError,
  sanitizeVaultPath,
  validateSymlinkSafety,
} from '../src/index.js';

function runVaultCoreTests() {
  console.log('🧪 Running Vault Core Unit Test Suite...');
  const testTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-vault-m2-test-'));

  try {
    // 1. Create & Open Vault
    const vaultPath = path.join(testTmpDir, 'NewVault');
    const status = VaultManager.createVault(vaultPath, 'My New Test Vault');
    const res = VaultManager.openVault(vaultPath);

    if (status.state !== 'READY' || !res.validation.isValid) {
      console.error('Validation errors:', res.validation.errors);
    }

    assert.strictEqual(status.state, 'READY');
    assert.strictEqual(status.name, 'My New Test Vault');
    assert.strictEqual(status.path, path.resolve(vaultPath));
    assert.strictEqual(status.integrityStatus, 'valid');
    assert.ok(status.pageCount >= 1);

    assert.strictEqual(res.status.state, 'READY');
    assert.strictEqual(res.validation.isValid, true);
    assert.strictEqual(res.validation.errors.length, 0);
    assert.strictEqual(res.validation.checkedFoldersCount, 15);
    console.log('  ✅ 1. Vault creation and opening passed');

    // 2. Protect existing data
    const occupiedPath = path.join(testTmpDir, 'OccupiedVault');
    VaultManager.createVault(occupiedPath, 'Initial Vault');

    assert.throws(
      () => {
        VaultCreator.createVault(occupiedPath, 'Conflicting Vault');
      },
      VaultAlreadyExistsError,
      'Should throw VaultAlreadyExistsError'
    );
    console.log('  ✅ 2. Zero overwrite protection passed');

    // 3. Detect non-existent path
    const nonExistentPath = path.join(testTmpDir, 'DoesNotExists12345');
    const { status: nonExistStatus, validation: nonExistVal } = VaultManager.openVault(nonExistentPath);
    assert.strictEqual(nonExistStatus.state, 'NOT_ACCESSIBLE');
    assert.strictEqual(nonExistVal.isValid, false);
    assert.ok(nonExistVal.errors[0].includes('does not exist'));
    console.log('  ✅ 3. Non-existent path detection passed');

    // 4. Incomplete vault structure
    const incompletePath = path.join(testTmpDir, 'IncompleteVault');
    VaultManager.createVault(incompletePath, 'Incomplete Vault');
    fs.rmSync(path.join(incompletePath, '04_POSITIONING'), { recursive: true, force: true });

    const { status: incStatus, validation: incVal } = VaultManager.openVault(incompletePath);
    assert.strictEqual(incStatus.state, 'INCOMPLETE');
    assert.strictEqual(incVal.isValid, false);
    assert.ok(incVal.errors.some((e) => e.includes('04_POSITIONING')));
    console.log('  ✅ 4. Incomplete vault structure detection passed');

    // 5. Corrupt manifest
    const corruptPath = path.join(testTmpDir, 'CorruptManifestVault');
    VaultManager.createVault(corruptPath, 'Corrupt Vault');
    fs.writeFileSync(path.join(corruptPath, '00_SYSTEM', 'VAULT_MANIFEST.json'), '{ invalid_json ', 'utf8');

    const { status: corruptStatus, validation: corruptVal } = VaultManager.openVault(corruptPath);
    assert.strictEqual(corruptStatus.state, 'INVALID');
    assert.strictEqual(corruptVal.isValid, false);
    console.log('  ✅ 5. Corrupt manifest detection passed');

    // 6. Path traversal protection
    const securePath = path.join(testTmpDir, 'SecureVault');
    VaultManager.createVault(securePath, 'Secure Vault');

    assert.throws(() => {
      sanitizeVaultPath(securePath, '../outside_secret.txt');
    }, SecurityPathError);

    assert.throws(() => {
      sanitizeVaultPath(securePath, '/etc/passwd');
    }, SecurityPathError);
    console.log('  ✅ 6. Path traversal protection passed');

    // 7. Symlink safety
    const symlinkPath = path.join(securePath, '01_CLIENTS', 'external_link.md');
    const outsideFile = path.join(testTmpDir, 'outside_secret.txt');
    fs.writeFileSync(outsideFile, 'secret', 'utf8');

    try {
      fs.symlinkSync(outsideFile, symlinkPath);
      assert.throws(() => {
        validateSymlinkSafety(securePath, symlinkPath);
      }, SecurityPathError);
      console.log('  ✅ 7. Symlink safety check passed');
    } catch (e) {
      if ((e as Error).name === 'AssertionError') throw e;
      console.log('  ⚠️  7. Symlink test skipped (privileges not available)');
    }

    // 8. Read-only invariant check
    const homeFile = path.join(securePath, '00_SYSTEM', 'HOME.md');
    const contentBefore = fs.readFileSync(homeFile, 'utf8');
    const mtimeBefore = fs.statSync(homeFile).mtimeMs;

    VaultManager.openVault(securePath);
    VaultValidator.validateVault(securePath);

    assert.strictEqual(fs.readFileSync(homeFile, 'utf8'), contentBefore);
    assert.strictEqual(fs.statSync(homeFile).mtimeMs, mtimeBefore);
    console.log('  ✅ 8. Read-only invariant verified');

    console.log('🎉 All Vault Core unit tests passed cleanly!');
  } finally {
    if (fs.existsSync(testTmpDir)) {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    }
  }
}

runVaultCoreTests();
