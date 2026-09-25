#!/bin/bash
# Package, sign with Developer ID, and notarize LIMEN Vault v6Mini for macOS tester distribution.
# Target folder is .local/limen-v5-release (as requested by user).
# All Apple credentials remain securely in Keychain (no secrets stored in script or repo).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

LIMEN_SIGN_IDENTITY="${LIMEN_SIGN_IDENTITY:-E01892F9C136DA67B393B9CD29AF97E369956968}"
if [ "${#LIMEN_SIGN_IDENTITY}" -ne 40 ]; then
    RESOLVED_SHA1="$(security find-identity -p codesigning -v | grep "Developer ID Application: Arkitecna" | head -n 1 | awk '{print $2}')"
    if [ -n "$RESOLVED_SHA1" ]; then
        LIMEN_SIGN_IDENTITY="$RESOLVED_SHA1"
    fi
fi
LIMEN_NOTARY_PROFILE="${LIMEN_NOTARY_PROFILE:-LIMEN-M9}"
OUT="${LIMEN_RELEASE_OUT:-$ROOT_DIR/.local/limen-v6mini-release}"
ENTITLEMENTS="$ROOT_DIR/apps/desktop/src-tauri/Entitlements.plist"
DMG="$OUT/LIMEN-Vault-v6Mini.dmg"

echo "=== LIMEN Vault v6Mini Packaging Pipeline (macOS) ==="
echo "Root: $ROOT_DIR"
echo "Output Directory: $OUT"
echo "Signing Identity SHA-1: $LIMEN_SIGN_IDENTITY"
echo "Notary Profile: $LIMEN_NOTARY_PROFILE"
echo "Target DMG: $DMG"

mkdir -p "$OUT"

# 1. Compilazione da copia pulita (worktree nuovo)
BUILD_WORKTREE="$(mktemp -d /tmp/limen-v6mini-build.XXXXXX)"
echo "Creazione worktree pulito in: $BUILD_WORKTREE"
git worktree add "$BUILD_WORKTREE" HEAD
echo "Sincronizzazione file di lavoro nel worktree..."
rsync -a --exclude='.git' --exclude='node_modules' --exclude='target' --exclude='.local' "$ROOT_DIR/" "$BUILD_WORKTREE/"

cleanup() {
    echo "Pulizia worktree temporaneo..."
    git worktree remove --force "$BUILD_WORKTREE" 2>/dev/null || rm -rf "$BUILD_WORKTREE"
}
trap cleanup EXIT

# Seeding cache cargo pre-esistente per accelerare la compilazione senza riscaricare crate
if [ -d "$ROOT_DIR/apps/desktop/src-tauri/target/release/deps" ]; then
    echo "Seeding cache release deps nel worktree..."
    mkdir -p "$BUILD_WORKTREE/apps/desktop/src-tauri/target/release"
    cp -R "$ROOT_DIR/apps/desktop/src-tauri/target/release/deps" "$BUILD_WORKTREE/apps/desktop/src-tauri/target/release/" 2>/dev/null || true
    cp -R "$ROOT_DIR/apps/desktop/src-tauri/target/release/build" "$BUILD_WORKTREE/apps/desktop/src-tauri/target/release/" 2>/dev/null || true
fi

echo "Compilazione dipendenze e frontend nel worktree pulito..."
(
    cd "$BUILD_WORKTREE"
    pnpm install --frozen-lockfile
    pnpm --filter @limen-vault/desktop build
)

# Verifica che dist/index.html sia l'interfaccia reale Vite e non il segnaposto da 53 byte
WORKTREE_INDEX="$BUILD_WORKTREE/apps/desktop/dist/index.html"
if [ ! -f "$WORKTREE_INDEX" ]; then
    echo "ERRORE CRITICO: dist/index.html non generato nel worktree!" >&2
    exit 1
fi
python3 - "$WORKTREE_INDEX" <<'PY'
import sys, pathlib
content = pathlib.Path(sys.argv[1]).read_text()
assert '<h1>LIMEN Vault</h1>' not in content, "Rilevato segnaposto di build.rs in dist/index.html!"
assert 'assets/index-' in content, "dist/index.html non contiene i bundle compilati di Vite/React!"
print("Verifica dist/index.html superata con successo: interfaccia reale Vite/React presente.")
PY

echo "Compilazione bundle app release con Tauri..."
(
    cd "$BUILD_WORKTREE"
    pnpm --filter @limen-vault/desktop tauri build --bundles app --no-sign
)

APP_SRC="$(find "$BUILD_WORKTREE/apps/desktop/src-tauri/target/release/bundle/macos" -maxdepth 1 -name "*.app" | head -n 1)"
if [ -z "$APP_SRC" ] || [ ! -d "$APP_SRC" ]; then
    echo "ERRORE: Bundle app non trovato in $BUILD_WORKTREE/apps/desktop/src-tauri/target/release/bundle/macos" >&2
    exit 1
fi

APP_NAME="$(basename "$APP_SRC")"
echo "Bundle app generato: $APP_NAME"
APP="$OUT/$APP_NAME"
rm -rf "$APP"
echo "Copia bundle app compilato in $APP..."
ditto "$APP_SRC" "$APP"

# 2. Rimozione di eventuali binari di debug/test cargo residui da Contents/MacOS
echo "Pulizia eseguibili secondari in Contents/MacOS..."
python3 - "$APP" <<'PY'
import pathlib, sys
macos = pathlib.Path(sys.argv[1]) / 'Contents/MacOS'
for p in list(macos.iterdir()):
    if p.name != 'limen-vault':
        print(f"Rimozione binario non di release: {p.name}")
        p.unlink()
assert [p.name for p in macos.iterdir()] == ['limen-vault'], f"Binari inattesi in {macos}"
PY

# Verifica che il binario principale contenga i bundle reali del frontend e non il segnaposto
python3 - "$APP/Contents/MacOS/limen-vault" <<'PY'
import sys, subprocess
data = subprocess.check_output(['strings', sys.argv[1]])
assert b'<h1>LIMEN Vault</h1>' not in data, "ERRORE: Rilevato segnaposto nel binario dell'app!"
assert b'assets/index-' in data, "ERRORE: Bundle frontend reale non presente nel binario dell'app!"
print("Verifica binario superata: interfaccia reale integrata nel binario limen-vault.")
PY

# 3. Pulizia attributi estesi prima della firma
xattr -cr "$APP"

# 4. Firma Developer ID dall'interno verso l'esterno con Hardened Runtime
echo "Firma librerie ed eseguibili nativi (Contents/Resources/native)..."
if [ -d "$APP/Contents/Resources/native" ]; then
    find "$APP/Contents/Resources/native" -type f \( -name "*.dylib" -o -name "*.so" -o -perm +111 \) | while read -r native_file; do
        echo "  Firma: $(basename "$native_file")"
        codesign --force --options runtime --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$native_file"
    done
fi

if [ -d "$APP/Contents/Resources/mcp" ]; then
    find "$APP/Contents/Resources/mcp" -type f -perm +111 | while read -r helper_file; do
        echo "  Firma helper MCP: $(basename "$helper_file")"
        codesign --force --options runtime --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$helper_file"
    done
fi

echo "Firma binario principale Contents/MacOS/limen-vault..."
codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$LIMEN_SIGN_IDENTITY" "$APP/Contents/MacOS/limen-vault"

echo "Firma bundle principale $APP_NAME con Hardened Runtime ed Entitlements..."
codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$LIMEN_SIGN_IDENTITY" "$APP"

echo "Verifica profonda della firma dell'applicazione..."
codesign --verify --deep --strict --verbose=2 "$APP"

# 5. Notarizzazione App
echo "Preparazione archivio app per notarizzazione Apple..."
APP_ZIP="$OUT/limen-v6mini-app-notarize.zip"
rm -f "$APP_ZIP"
ditto -c -k --keepParent "$APP" "$APP_ZIP"

echo "Invio app a Apple notarytool (profilo: $LIMEN_NOTARY_PROFILE)..."
xcrun notarytool submit "$APP_ZIP" --keychain-profile "$LIMEN_NOTARY_PROFILE" --no-s3-acceleration --wait --timeout 15m --output-format json > "$OUT/app-v6mini-notary.json"

python3 - "$OUT/app-v6mini-notary.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
status = data.get("status")
print(f"Esito notarizzazione app: {status} (id: {data.get('id')})")
assert status == "Accepted", f"Notarizzazione app fallita: {data}"
PY

echo "Graffettatura ticket di notarizzazione su $APP_NAME..."
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"

# 6. Creazione DMG
STAGE="$OUT/stage-v6mini"
rm -rf "$STAGE"
mkdir -p "$STAGE"
ditto "$APP" "$STAGE/$APP_NAME"
ln -s /Applications "$STAGE/Applications"
cp "$ROOT_DIR/IMPLEMENTATION/ISTRUZIONI_TESTER_MAC.md" "$STAGE/ISTRUZIONI_TESTER.md"
cp "$ROOT_DIR/manuale UI utente.txt" "$STAGE/manuale UI utente.txt"
cp "$ROOT_DIR/MANUALE UTENTE.MD" "$STAGE/MANUALE_UTENTE.md"

rm -f "$DMG"
echo "Creazione immagine disco UDZO: $DMG..."
hdiutil create -volname 'LIMEN Vault v6Mini' -srcfolder "$STAGE" -format UDZO "$DMG"

echo "Firma Developer ID del file DMG..."
codesign --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$DMG"

# 7. Notarizzazione DMG
echo "Invio DMG a Apple notarytool (profilo: $LIMEN_NOTARY_PROFILE)..."
xcrun notarytool submit "$DMG" --keychain-profile "$LIMEN_NOTARY_PROFILE" --no-s3-acceleration --wait --timeout 15m --output-format json > "$OUT/dmg-v6mini-notary.json"

python3 - "$OUT/dmg-v6mini-notary.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
status = data.get("status")
print(f"Esito notarizzazione DMG: {status} (id: {data.get('id')})")
assert status == "Accepted", f"Notarizzazione DMG fallita: {data}"
PY

echo "Graffettatura ticket di notarizzazione su DMG..."
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"

# 8. Verifiche finali Gatekeeper
echo "Verifica Gatekeeper (spctl) sull'applicazione..."
spctl --assess --type execute --verbose=4 "$APP"

echo "Verifica Gatekeeper (spctl) sull'immagine disco..."
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG"

# 9. Calcolo metadati finali
shasum -a 256 "$DMG" > "$OUT/SHA256SUMS-v6mini.txt"
stat -f%z "$DMG" > "$OUT/DMG_SIZE_BYTES_v6mini.txt"

echo "=== PACCHETTO v6Mini COMPLETATO CON SUCCESSO ==="
echo "DMG Percorso: $DMG"
echo "DMG Dimensione: $(cat "$OUT/DMG_SIZE_BYTES_v6mini.txt") byte"
echo "DMG SHA-256: $(cat "$OUT/SHA256SUMS-v6mini.txt")"

USER_INSTALL_DIR="$ROOT_DIR/USER INSTALL"
mkdir -p "$USER_INSTALL_DIR"
cp -f "$DMG" "$USER_INSTALL_DIR/LIMEN-Vault-v6Mini.dmg"
echo "Copiato in: $USER_INSTALL_DIR/LIMEN-Vault-v6Mini.dmg"
