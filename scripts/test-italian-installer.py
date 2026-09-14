"""Real install/upgrade checks using isolated directories; never touch the user's Vault."""
from pathlib import Path
import hashlib, json, shutil, subprocess, sys, tempfile

root = Path(__file__).resolve().parents[1]
installer = Path(sys.argv[1]).resolve()
accepted = root / '.local/ui-it-notarized-20260913/LIMEN Vault.app'
previous = root / '.local/ui-it/installata-precedente/LIMEN Vault 0.2.0.app'
obsidian = Path.home() / 'Applications/Obsidian.app'
assert installer.is_file() and accepted.is_dir() and previous.is_dir() and obsidian.is_dir()

def digest(app):
    return hashlib.sha256((app / 'Contents/MacOS/limen-vault').read_bytes()).hexdigest()

def copy(source, target):
    subprocess.run(['ditto', str(source), str(target)], check=True)

bank = Path(tempfile.mkdtemp(prefix='limen-installer-test-it-', dir='/tmp'))
(bank / 'Obsidian.app').symlink_to(obsidian, target_is_directory=True)
sentinel = bank / 'Vault-personale-conservato.md'
sentinel.write_text('Documento locale di prova da conservare, non pubblicare.\n')
before = sentinel.read_bytes()
logs = []
def run():
    result = subprocess.run([str(installer), '--test-install', str(bank), '/tmp/unused-obsidian-image.dmg'], capture_output=True, text=True)
    logs.append(result.stdout + result.stderr)
    return result

fresh = run()
assert fresh.returncode == 0, fresh.stdout + fresh.stderr
installed = bank / 'LIMEN Vault 0.2.0.app'
assert digest(installed) == digest(accepted)
subprocess.run(['spctl', '--assess', '--type', 'execute', str(installed)], check=True)
installed.rename(bank / 'fresh-italian.app')
copy(previous, installed)
old_hash = digest(installed)
assert old_hash != digest(accepted), 'The update test needs a genuinely different old executable.'
updated = run()
assert updated.returncode == 0, updated.stdout + updated.stderr
assert digest(installed) == digest(accepted)
backups = list((bank / 'LIMEN - versioni precedenti').glob('*.app'))
assert len(backups) == 1 and digest(backups[0]) == old_hash
assert sentinel.read_bytes() == before
subprocess.run(['codesign', '--verify', '--deep', '--strict', str(installed)], check=True)
installed.rename(bank / 'updated-italian.app')
installed.mkdir()
(installed / 'do-not-overwrite.txt').write_text('Preservare destinazione non valida')
refused = run()
assert refused.returncode != 0
assert (installed / 'do-not-overwrite.txt').read_text() == 'Preservare destinazione non valida'
assert sentinel.read_bytes() == before
assert len(list((bank / 'LIMEN - versioni precedenti').glob('*.app'))) == 1
report = {'fresh_install':'PASS','upgrade_from_english_0_2_0':'PASS','old_app_preserved':'PASS','vault_sentinel_unchanged':'PASS','untrusted_destination_refused':'PASS','gatekeeper_fresh':'PASS','signature_updated':'PASS','bank':str(bank),'installed_app':str(bank/'updated-italian.app'),'binary_sha256':digest(accepted)}
evidence = root / 'IMPLEMENTATION/UI_IT_EVIDENCE/notarized'
(evidence / 'installer-tests.json').write_text(json.dumps(report, indent=2) + '\n')
(evidence / 'installer-tests.log').write_text('\n'.join(logs))
print(json.dumps(report, indent=2))
