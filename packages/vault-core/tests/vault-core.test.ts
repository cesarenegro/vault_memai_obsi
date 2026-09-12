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
  parseYamlFrontmatter,
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
    assert.strictEqual(status.integrityStatus, 'unverified');
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
    assert.strictEqual(corruptStatus.name, 'CorruptManifestVault'); // Must not use corrupt manifest data
    console.log('  ✅ 5. Corrupt manifest detection passed');

    // 6. Path traversal & prefix escape protection (e.g. vault-outside)
    const securePath = path.join(testTmpDir, 'SecureVault');
    const siblingPath = path.join(testTmpDir, 'SecureVault-outside');
    fs.mkdirSync(siblingPath, { recursive: true });
    VaultManager.createVault(securePath, 'Secure Vault');

    assert.throws(() => {
      sanitizeVaultPath(securePath, '../outside_secret.txt');
    }, SecurityPathError);

    assert.throws(() => {
      sanitizeVaultPath(securePath, '/etc/passwd');
    }, SecurityPathError);

    assert.throws(() => {
      sanitizeVaultPath(securePath, '../SecureVault-outside');
    }, SecurityPathError);
    console.log('  ✅ 6. Path traversal and prefix escape (vault-outside) protection passed');

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

    // 8. System file directory masquerading rejection
    const masqVaultPath = path.join(testTmpDir, 'MasqVault');
    VaultManager.createVault(masqVaultPath, 'Masquerading Vault');
    const homeFilePath = path.join(masqVaultPath, '00_SYSTEM', 'HOME.md');
    fs.rmSync(homeFilePath, { force: true });
    fs.mkdirSync(homeFilePath); // Replace HOME.md with a directory!

    const masqRes = VaultManager.openVault(masqVaultPath);
    assert.strictEqual(masqRes.validation.isValid, false);
    assert.ok(masqRes.validation.errors.some((e) => e.includes('not a regular file')));
    console.log('  ✅ 8. System file directory masquerading rejection passed');

    // 9. Multiline YAML frontmatter with js-yaml
    const yamlVaultPath = path.join(testTmpDir, 'YamlVault');
    VaultManager.createVault(yamlVaultPath, 'YAML Vault');
    const mdTestFile = path.join(yamlVaultPath, '01_CLIENTS', 'test_multiline.md');
    fs.writeFileSync(
      mdTestFile,
      `---
title: "Test Multiline"
tags:
  - client
  - active
  - high-priority
date: 2026-09-11
---
# Content`,
      'utf8'
    );
    const content = fs.readFileSync(mdTestFile, 'utf8');
    const parsedFrontmatter = parseYamlFrontmatter(content);
    assert.ok(parsedFrontmatter && parsedFrontmatter.data);
    assert.strictEqual(parsedFrontmatter.syntaxError, undefined);
    assert.deepStrictEqual(parsedFrontmatter.data.tags, ['client', 'active', 'high-priority']);
    console.log('  ✅ 9. Multiline YAML frontmatter parsing passed');

    // 10. Invalid YAML syntax rejection
    const badYamlVaultPath = path.join(testTmpDir, 'BadYamlVault');
    VaultManager.createVault(badYamlVaultPath, 'Bad YAML Vault');
    const badMdFile = path.join(badYamlVaultPath, '01_CLIENTS', 'bad_syntax.md');
    fs.writeFileSync(
      badMdFile,
      `---
title: "Unclosed String
invalid: [unclosed list
---
# Content`,
      'utf8'
    );
    const badYamlRes = VaultManager.openVault(badYamlVaultPath);
    assert.strictEqual(badYamlRes.validation.isValid, false, 'Vault with invalid YAML syntax must be invalid');
    assert.ok(
      badYamlRes.validation.errors.some((e) => e.includes('Invalid YAML syntax')),
      'Should report Invalid YAML syntax error'
    );
    console.log('  ✅ 10. Invalid YAML syntax rejection passed');

    // 11. Read-only invariant check (content, mtimeMs, ctimeMs)
    const homeFile = path.join(securePath, '00_SYSTEM', 'HOME.md');
    const contentBefore = fs.readFileSync(homeFile, 'utf8');
    const statBefore = fs.statSync(homeFile);

    VaultManager.openVault(securePath);
    VaultValidator.validateVault(securePath);

    const statAfter = fs.statSync(homeFile);
    assert.strictEqual(fs.readFileSync(homeFile, 'utf8'), contentBefore, 'Content must not be modified');
    assert.strictEqual(statAfter.mtimeMs, statBefore.mtimeMs, 'Modification time (mtime) must not be altered');
    assert.strictEqual(statAfter.ctimeMs, statBefore.ctimeMs, 'Change time (ctime) must not be altered');
    console.log('  ✅ 11. Read-only invariant (content, mtime, ctime) verified');

    console.log('🎉 All Vault Core unit tests passed cleanly!');
  } finally {
    if (fs.existsSync(testTmpDir)) {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    }
  }
}

runVaultCoreTests();
