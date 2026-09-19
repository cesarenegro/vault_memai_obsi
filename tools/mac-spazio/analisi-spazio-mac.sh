#!/bin/bash
# analisi-spazio-mac.sh
# Analisi dello spazio su disco del Mac. SOLA LETTURA: non cancella e non sposta nulla.
# Uso:  bash analisi-spazio-mac.sh
# Il rapporto viene stampato a schermo e salvato sulla Scrivania.

set -u

REPORT="$HOME/Desktop/analisi-spazio-$(date +%Y%m%d-%H%M%S).txt"
SOGLIA_FILE_MB=500          # elenca i file singoli piu grandi di questo valore
SOGLIA_APP_MB=200           # elenca le app piu grandi di questo valore
GIORNI_APP_INUTILIZZATA=90  # segnala le app non aperte da piu giorni di questi

exec > >(tee "$REPORT") 2>&1

titolo() { printf "\n\n===== %s =====\n" "$1"; }
riga()   { printf -- "-----------------------------------------------------------\n"; }

dim() {
  if [ -e "$1" ]; then du -shx "$1" 2>/dev/null | awk '{print $1}'; else printf "assente"; fi
}

dim_mb() {
  if [ -e "$1" ]; then du -smx "$1" 2>/dev/null | awk '{print $1+0}'; else printf "0"; fi
}

printf "ANALISI SPAZIO DISCO - %s (%s)\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$(date +%Z)"
printf "Mac: %s - utente: %s\n" "$(scutil --get ComputerName 2>/dev/null)" "$USER"
printf "Rapporto salvato in: %s\n" "$REPORT"
printf "Questo script non modifica nessun file.\n"

titolo "1. SPAZIO DEL DISCO"
df -h / /System/Volumes/Data 2>/dev/null
riga
diskutil info / 2>/dev/null | grep -iE "Container Free Space|Volume Free Space|Free Space"

titolo "2. ISTANTANEE LOCALI DI TIME MACHINE"
printf "Le istantanee locali occupano spazio finche macOS non le elimina.\n"
tmutil listlocalsnapshots / 2>/dev/null || printf "Nessuna istantanea elencabile.\n"

titolo "3. CARTELLE DI SVILUPPO XCODE"
for p in \
  "$HOME/Library/Developer/Xcode/DerivedData" \
  "$HOME/Library/Developer/Xcode/Archives" \
  "$HOME/Library/Developer/Xcode/iOS DeviceSupport" \
  "$HOME/Library/Developer/Xcode/watchOS DeviceSupport" \
  "$HOME/Library/Developer/Xcode/tvOS DeviceSupport" \
  "$HOME/Library/Developer/Xcode/UserData/Previews" \
  "$HOME/Library/Developer/Xcode/DocumentationCache" \
  "$HOME/Library/Developer/CoreSimulator/Devices" \
  "$HOME/Library/Developer/CoreSimulator/Caches" \
  "$HOME/Library/Developer/XCTestDevices" \
  "$HOME/Library/Caches/com.apple.dt.Xcode" ; do
  printf "%10s  %s\n" "$(dim "$p")" "$p"
done
riga
printf "Simulatori non piu disponibili (rimozione: xcrun simctl delete unavailable):\n"
xcrun simctl list devices 2>/dev/null | grep -i unavailable | head -20

titolo "4. CACHE DEGLI STRUMENTI DI SVILUPPO"
for p in \
  "$HOME/.npm/_cacache" \
  "$HOME/Library/pnpm/store" \
  "$HOME/Library/Caches/pnpm" \
  "$HOME/Library/Caches/Yarn" \
  "$HOME/Library/Caches/Homebrew" \
  "$HOME/Library/Caches/pip" \
  "$HOME/Library/Caches/go-build" \
  "$HOME/Library/Caches/ms-playwright" \
  "$HOME/Library/Caches/deno" \
  "$HOME/.cargo/registry" \
  "$HOME/.cargo/git" \
  "$HOME/.rustup/toolchains" \
  "$HOME/go/pkg/mod" \
  "$HOME/.gradle/caches" \
  "$HOME/Library/Android/sdk" \
  "$HOME/.docker" ; do
  printf "%10s  %s\n" "$(dim "$p")" "$p"
done
riga
if command -v docker >/dev/null 2>&1; then
  printf "Docker (immagini, contenitori, volumi):\n"
  docker system df 2>/dev/null || printf "Docker installato ma non in esecuzione.\n"
else
  printf "Docker non installato.\n"
fi

titolo "5. CARTELLE DI COMPILAZIONE NEI PROGETTI (oltre 100 MB)"
printf "Ricerca fino a 6 livelli sotto la cartella utente.\n"
riga
find "$HOME" -maxdepth 6 -type d \
  \( -name node_modules -o -name target -o -name .next -o -name dist -o -name build -o -name .turbo -o -name .venv \) \
  -prune 2>/dev/null \
| while IFS= read -r d; do
    mb=$(dim_mb "$d")
    if [ "$mb" -ge 100 ]; then printf "%8s MB  %s\n" "$mb" "$d"; fi
  done | sort -rn | head -40

titolo "6. CARTELLE PRINCIPALI DELLA HOME"
for p in \
  "$HOME/Desktop" "$HOME/Documents" "$HOME/Downloads" "$HOME/Movies" \
  "$HOME/Music" "$HOME/Pictures" "$HOME/Library" "$HOME/Applications" \
  "$HOME/Library/Caches" "$HOME/Library/Containers" "$HOME/Library/Application Support" \
  "$HOME/Library/Group Containers" "$HOME/Library/Logs" "$HOME/Library/Mail" \
  "$HOME/Library/Messages" "$HOME/Library/Application Support/MobileSync" \
  "$HOME/Library/CloudStorage" "$HOME/.Trash" ; do
  printf "%10s  %s\n" "$(dim "$p")" "$p"
done

titolo "7. LE 25 VOCI PIU GRANDI DI ~/Library/Application Support"
du -shx "$HOME/Library/Application Support/"* 2>/dev/null | sort -h | tail -25

titolo "8. LE 25 VOCI PIU GRANDI DI ~/Library/Caches"
du -shx "$HOME/Library/Caches/"* 2>/dev/null | sort -h | tail -25

titolo "9. APPLICAZIONI INSTALLATE OLTRE ${SOGLIA_APP_MB} MB"
printf "%8s  %-12s  %s\n" "MB" "ULTIMO USO" "APPLICAZIONE"
riga
for dir in "/Applications" "/Applications/Utilities" "$HOME/Applications"; do
  [ -d "$dir" ] || continue
  for app in "$dir"/*.app; do
    [ -e "$app" ] || continue
    mb=$(dim_mb "$app")
    [ "$mb" -ge "$SOGLIA_APP_MB" ] || continue
    uso=$(mdls -name kMDItemLastUsedDate -raw "$app" 2>/dev/null | cut -c1-10)
    if [ -z "$uso" ] || [ "$uso" = "(null)" ]; then uso="ignoto"; fi
    printf "%8s  %-12s  %s\n" "$mb" "$uso" "$app"
  done
done | sort -rn

titolo "10. APPLICAZIONI NON APERTE DA PIU DI ${GIORNI_APP_INUTILIZZATA} GIORNI"
printf "Elenco informativo: macOS non registra sempre la data di ultimo uso.\n"
riga
limite=$(date -v-${GIORNI_APP_INUTILIZZATA}d +%s 2>/dev/null)
for dir in "/Applications" "$HOME/Applications"; do
  [ -d "$dir" ] || continue
  for app in "$dir"/*.app; do
    [ -e "$app" ] || continue
    raw=$(mdls -name kMDItemLastUsedDate -raw "$app" 2>/dev/null)
    if [ -z "$raw" ] || [ "$raw" = "(null)" ]; then
      printf "%10s  ignoto       %s\n" "$(dim "$app")" "$app"
      continue
    fi
    ts=$(date -j -f "%Y-%m-%d %H:%M:%S %z" "$raw" +%s 2>/dev/null)
    if [ -n "${ts:-}" ] && [ -n "${limite:-}" ] && [ "$ts" -lt "$limite" ]; then
      printf "%10s  %s   %s\n" "$(dim "$app")" "$(printf "%s" "$raw" | cut -c1-10)" "$app"
    fi
  done
done

titolo "11. FILE SINGOLI OLTRE ${SOGLIA_FILE_MB} MB NELLA HOME"
find "$HOME" -type f -size +${SOGLIA_FILE_MB}M \
  -not -path "*/Library/CloudStorage/*" -not -path "*/.Trash/*" 2>/dev/null \
| while IFS= read -r f; do
    printf "%8s MB  %s\n" "$(( $(stat -f%z "$f" 2>/dev/null) / 1048576 ))" "$f"
  done | sort -rn | head -40

titolo "12. IMMAGINI DISCO E ARCHIVI OLTRE 200 MB"
find "$HOME" -type f \
  \( -name "*.dmg" -o -name "*.iso" -o -name "*.zip" -o -name "*.pkg" -o -name "*.tar.gz" \) \
  -size +200M -not -path "*/Library/CloudStorage/*" 2>/dev/null \
| while IFS= read -r f; do
    printf "%8s MB  %s\n" "$(( $(stat -f%z "$f" 2>/dev/null) / 1048576 ))" "$f"
  done | sort -rn | head -30

titolo "13. BACKUP DI IPHONE E IPAD SUL MAC"
b="$HOME/Library/Application Support/MobileSync/Backup"
if [ -d "$b" ]; then du -shx "$b"/* 2>/dev/null | sort -h; else printf "Nessun backup locale.\n"; fi

titolo "FINE"
printf "Rapporto salvato in: %s\n" "$REPORT"
printf "Nessun file e stato modificato.\n"
