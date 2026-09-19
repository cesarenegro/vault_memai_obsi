#!/bin/bash
# pulizia-spazio-mac.sh
# Libera spazio su macOS rimuovendo cache e file ricostruibili.
#
# Uso:
#   bash pulizia-spazio-mac.sh                  anteprima: mostra cosa verrebbe liberato, non tocca nulla
#   bash pulizia-spazio-mac.sh --esegui         esegue, chiedendo conferma per ogni categoria
#   bash pulizia-spazio-mac.sh --esegui --auto  esegue senza chiedere le categorie ricostruibili (1-7);
#                                               le categorie 8-11 chiedono comunque conferma
#   bash pulizia-spazio-mac.sh --esegui --auto --solo-cache
#                                               esegue solo le categorie 1-7 (Xcode e cache) e si ferma
#   bash pulizia-spazio-mac.sh --esegui --svuota-cestino   aggiunge lo svuotamento del Cestino
#
# Cosa NON tocca mai: Documenti, Scrivania, Download, Foto, Mail, backup di iPhone,
# cartelle iCloud/Drive, il Vault LIMEN, i file sorgente dei progetti.
# Le cartelle cancellate vengono ricreate dagli strumenti al primo uso successivo.

set -u

ESEGUI=0; AUTO=0; CESTINO=0; SOLO_CACHE=0
for arg in "$@"; do
  case "$arg" in
    --esegui) ESEGUI=1 ;;
    --auto) AUTO=1 ;;
    --solo-cache) SOLO_CACHE=1 ;;
    --svuota-cestino) CESTINO=1 ;;
    *) printf "Parametro non riconosciuto: %s\n" "$arg"; exit 2 ;;
  esac
done

LOG="$HOME/Desktop/pulizia-spazio-$(date +%Y%m%d-%H%M%S).txt"
exec > >(tee "$LOG") 2>&1

libero_kb() { df -k / | awk 'NR==2{print $4}'; }
LIBERO_INIZIO=$(libero_kb)

titolo() { printf "\n\n===== %s =====\n" "$1"; }

dim_mb() {
  if [ -e "$1" ]; then du -smx "$1" 2>/dev/null | awk '{print $1+0}'; else printf "0"; fi
}

# chiedi CATEGORIA_SICURA(0|1) TESTO -> 0 = procedi, 1 = salta
chiedi() {
  local sicura="$1"; local testo="$2"; local risposta
  if [ "$ESEGUI" -eq 0 ]; then return 1; fi
  if [ "$sicura" -eq 1 ] && [ "$AUTO" -eq 1 ]; then return 0; fi
  printf "\n%s\n" "$testo"
  printf "Procedo? [s/N] "
  read -r risposta < /dev/tty
  case "$risposta" in s|S|si|SI|Si) return 0 ;; *) printf "Saltata.\n"; return 1 ;; esac
}

# rimuovi PERCORSO...  : mostra la dimensione e cancella solo se ESEGUI=1
totale_stimato=0
rimuovi() {
  local p mb
  for p in "$@"; do
    [ -e "$p" ] || continue
    mb=$(dim_mb "$p")
    totale_stimato=$((totale_stimato + mb))
    if [ "$ESEGUI" -eq 1 ]; then
      rm -rf "$p" 2>/dev/null && printf "  rimosso   %6s MB  %s\n" "$mb" "$p" \
        || printf "  ERRORE                %s\n" "$p"
    else
      printf "  da rimuovere %6s MB  %s\n" "$mb" "$p"
    fi
  done
}

# sposta_nel_cestino PERCORSO : usa il Finder, quindi il file resta recuperabile
sposta_nel_cestino() {
  local p mb
  for p in "$@"; do
    [ -e "$p" ] || continue
    mb=$(dim_mb "$p")
    totale_stimato=$((totale_stimato + mb))
    if [ "$ESEGUI" -eq 1 ]; then
      osascript -e "tell application \"Finder\" to delete POSIX file \"$p\"" >/dev/null 2>&1 \
        && printf "  nel Cestino %6s MB  %s\n" "$mb" "$p" \
        || printf "  ERRORE                 %s\n" "$p"
    else
      printf "  nel Cestino %6s MB  %s\n" "$mb" "$p"
    fi
  done
}

printf "PULIZIA SPAZIO MAC - %s (%s)\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$(date +%Z)"
printf "Registro salvato in: %s\n" "$LOG"
if [ "$ESEGUI" -eq 0 ]; then
  printf "MODALITA ANTEPRIMA: non viene cancellato nulla.\n"
  printf "Per eseguire davvero: bash %s --esegui\n" "$0"
else
  printf "MODALITA ESECUZIONE: le voci confermate vengono rimosse.\n"
fi
printf "Spazio libero ora: %s\n" "$(df -h / | awk 'NR==2{print $4}')"

titolo "1. XCODE - DerivedData (compilazioni intermedie, si ricreano)"
if chiedi 1 "Rimuovo DerivedData di Xcode." || [ "$ESEGUI" -eq 0 ]; then
  rimuovi "$HOME/Library/Developer/Xcode/DerivedData"
fi

titolo "2. XCODE - supporto dispositivi collegati (si riscarica al collegamento)"
if chiedi 1 "Rimuovo il supporto dispositivi iOS/watchOS/tvOS." || [ "$ESEGUI" -eq 0 ]; then
  rimuovi "$HOME/Library/Developer/Xcode/iOS DeviceSupport" \
          "$HOME/Library/Developer/Xcode/watchOS DeviceSupport" \
          "$HOME/Library/Developer/Xcode/tvOS DeviceSupport"
fi

titolo "3. XCODE - anteprime, cache e documentazione (si ricreano)"
if chiedi 1 "Rimuovo anteprime e cache di Xcode." || [ "$ESEGUI" -eq 0 ]; then
  rimuovi "$HOME/Library/Developer/Xcode/UserData/Previews" \
          "$HOME/Library/Developer/Xcode/DocumentationCache" \
          "$HOME/Library/Caches/com.apple.dt.Xcode" \
          "$HOME/Library/Developer/CoreSimulator/Caches"
fi

titolo "4. XCODE - simulatori non piu disponibili"
if [ "$ESEGUI" -eq 0 ]; then
  xcrun simctl list devices 2>/dev/null | grep -i unavailable | head -20
  printf "  (con --esegui viene lanciato: xcrun simctl delete unavailable)\n"
elif chiedi 1 "Elimino i simulatori marcati come non disponibili."; then
  xcrun simctl delete unavailable 2>&1 | head -20
fi

titolo "5. XCODE - Archives (contengono i simboli delle build consegnate)"
printf "ATTENZIONE: servono per i rapporti di crash e per ri-notarizzare una build vecchia.\n"
if [ "$ESEGUI" -eq 0 ]; then
  for a in "$HOME/Library/Developer/Xcode/Archives/"*; do
    [ -e "$a" ] || continue
    printf "  nel Cestino %6s MB  %s\n" "$(dim_mb "$a")" "$a"
  done
elif chiedi 0 "Sposto nel Cestino tutti gli Archives di Xcode (recuperabili dal Cestino)."; then
  for a in "$HOME/Library/Developer/Xcode/Archives/"*; do
    [ -e "$a" ] || continue
    sposta_nel_cestino "$a"
  done
fi

titolo "6. CACHE DI NODE, PNPM, YARN, PIP, HOMEBREW, PLAYWRIGHT"
if chiedi 1 "Svuoto le cache dei gestori di pacchetti." || [ "$ESEGUI" -eq 0 ]; then
  rimuovi "$HOME/.npm/_cacache" \
          "$HOME/Library/Caches/Yarn" \
          "$HOME/Library/Caches/pip" \
          "$HOME/Library/Caches/go-build" \
          "$HOME/Library/Caches/ms-playwright" \
          "$HOME/Library/Caches/deno"
  if [ "$ESEGUI" -eq 1 ]; then
    command -v pnpm >/dev/null 2>&1 && pnpm store prune 2>&1 | tail -3
    command -v brew >/dev/null 2>&1 && brew cleanup -s 2>&1 | tail -5
  else
    printf "  con --esegui vengono lanciati anche: pnpm store prune, brew cleanup -s\n"
  fi
fi

titolo "7. CACHE DI RUST (registry e checkout git)"
if chiedi 1 "Rimuovo le cache scaricabili di Cargo (i sorgenti si riscaricano)." || [ "$ESEGUI" -eq 0 ]; then
  rimuovi "$HOME/.cargo/registry/cache" \
          "$HOME/.cargo/registry/src" \
          "$HOME/.cargo/git/checkouts"
fi

if [ "$SOLO_CACHE" -eq 1 ]; then
  titolo "RIEPILOGO (modalita --solo-cache: categorie 8-11 non eseguite)"
  LIBERO_FINE=$(libero_kb)
  if [ "$ESEGUI" -eq 1 ]; then
    printf "Spazio libero prima: %s MB\n" "$((LIBERO_INIZIO / 1024))"
    printf "Spazio libero dopo:  %s MB\n" "$((LIBERO_FINE / 1024))"
    printf "Differenza:          %s MB\n" "$(((LIBERO_FINE - LIBERO_INIZIO) / 1024))"
    printf "Nota: le voci spostate nel Cestino liberano spazio solo dopo lo svuotamento.\n"
  else
    printf "Spazio recuperabile stimato dalle voci elencate: %s MB\n" "$totale_stimato"
  fi
  printf "Registro: %s\n" "$LOG"
  exit 0
fi

titolo "8. CARTELLE DI COMPILAZIONE NEI PROGETTI (target e node_modules oltre 100 MB)"
printf "Si ricreano con: cargo build oppure pnpm install. Elenco:\n"
ELENCO="$(mktemp /tmp/pulizia-progetti.XXXXXX)"
find "$HOME" -maxdepth 6 -type d \( -name node_modules -o -name target -o -name .next -o -name .turbo \) -prune 2>/dev/null \
| while IFS= read -r d; do
    mb=$(dim_mb "$d")
    if [ "$mb" -ge 100 ]; then printf "%s\t%s\n" "$mb" "$d"; fi
  done | sort -rn > "$ELENCO"
awk -F'\t' '{printf "  %8s MB  %s\n", $1, $2}' "$ELENCO"
if [ -s "$ELENCO" ] && chiedi 0 "Rimuovo TUTTE le cartelle elencate sopra."; then
  while IFS=$'\t' read -r mb d; do rimuovi "$d"; done < "$ELENCO"
fi
rm -f "$ELENCO"

titolo "9. DOCKER (immagini, contenitori e cache di build non usati)"
if command -v docker >/dev/null 2>&1; then
  docker system df 2>/dev/null || printf "Docker non in esecuzione.\n"
  if [ "$ESEGUI" -eq 1 ] && chiedi 0 "Lancio docker system prune -a --volumes (rimuove anche i volumi non usati)."; then
    docker system prune -a --volumes -f 2>&1 | tail -5
  fi
else
  printf "Docker non installato.\n"
fi

titolo "10. ISTANTANEE LOCALI DI TIME MACHINE"
tmutil listlocalsnapshots / 2>/dev/null
if [ "$ESEGUI" -eq 1 ] && chiedi 0 "Elimino le istantanee locali (i backup sul disco esterno restano)."; then
  tmutil deletelocalsnapshots / 2>&1 | tail -10
fi

titolo "11. CESTINO"
printf "Dimensione attuale del Cestino: %s MB\n" "$(dim_mb "$HOME/.Trash")"
if [ "$CESTINO" -eq 1 ] && [ "$ESEGUI" -eq 1 ]; then
  printf "Lo svuotamento del Cestino e definitivo. Scrivi SVUOTA per confermare: "
  read -r conferma < /dev/tty
  if [ "$conferma" = "SVUOTA" ]; then
    osascript -e 'tell application "Finder" to empty trash' >/dev/null 2>&1 \
      && printf "Cestino svuotato.\n" || printf "Svuotamento non riuscito.\n"
  else
    printf "Cestino non svuotato.\n"
  fi
else
  printf "Il Cestino non viene toccato (per svuotarlo: --esegui --svuota-cestino).\n"
fi

titolo "RIEPILOGO"
LIBERO_FINE=$(libero_kb)
if [ "$ESEGUI" -eq 1 ]; then
  printf "Spazio libero prima: %s MB\n" "$((LIBERO_INIZIO / 1024))"
  printf "Spazio libero dopo:  %s MB\n" "$((LIBERO_FINE / 1024))"
  printf "Differenza:          %s MB\n" "$(((LIBERO_FINE - LIBERO_INIZIO) / 1024))"
  printf "Nota: le voci spostate nel Cestino liberano spazio solo dopo lo svuotamento.\n"
else
  printf "Spazio recuperabile stimato dalle voci elencate: %s MB\n" "$totale_stimato"
  printf "Per eseguire: bash %s --esegui\n" "$0"
fi
printf "Registro: %s\n" "$LOG"
