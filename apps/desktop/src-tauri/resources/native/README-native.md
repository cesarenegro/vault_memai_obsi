# Documentazione Componenti Nativi e Patch Binaria libggml.0.dylib

## Origine del Componente
- **Libreria**: `libggml.0.dylib`
- **Provenienza originale**: Homebrew pacchetto `ggml` versione `0.24.0` (`/opt/homebrew/Cellar/ggml/0.24.0/lib/libggml.0.dylib`).
- **Problema**: Nel codice compilato di `ggml_backend_load_best`, il percorso predefinito per la ricerca dinamica dei backend CPU/Metal (`libggml-cpu-apple_*.so`, `libggml-metal.so`) era cablato alla stringa assoluta:
  `/opt/homebrew/Cellar/ggml/0.24.0/libexec` (38 byte).
  Sui Mac dei tester o su sistemi privi di Homebrew, questa ricerca falliva o tentava di accedere a percorsi di sistema esterni inesistenti.

## Modifica Binaria Applicata
Per eliminare la dipendenza da Homebrew senza richiedere la ricompilazione dell'intera toolchain C/C++ di ggml e preservando la struttura Mach-O e gli offset dei segmenti, la stringa è stata sostituita con `.` (directory corrente) seguito da byte nulli (`\x00`) fino a raggiungere la lunghezza identica di 38 byte:
- Vecchio valore: `b'/opt/homebrew/Cellar/ggml/0.24.0/libexec'` (38 byte)
- Nuovo valore: `b'.\x00' + b'\x00' * 36` (38 byte)

In accoppiata, `apps/desktop/src-tauri/src/llama.rs` imposta `cmd.current_dir(parent)` al lancio di `llama-server`, garantendo che la CWD del processo sia sempre la cartella `Contents/Resources/native` dell'app bundle installata.

### Comando Esatto Usato per la Sostituzione
```python
python3 -c '
import pathlib
p = pathlib.Path("apps/desktop/src-tauri/resources/native/libggml.0.dylib")
data = p.read_bytes()
old_str = b"/opt/homebrew/Cellar/ggml/0.24.0/libexec"
new_str = b"." + b"\x00" * (len(old_str) - 1)
assert old_str in data, "Stringa Homebrew non trovata nel binario"
patched = data.replace(old_str, new_str, 1)
p.write_bytes(patched)
print("Patch binaria applicata con successo.")
'
```

### Impronte Crittografiche SHA-256
- **SHA-256 prima della modifica (commit bb2031f)**:
  `c65ec496ffc7917137ef4f0e0349f965ee97bfb0343da784e800fc0fc2c98ea0`
- **SHA-256 dopo la modifica**:
  `4b55405960888c0242b006df06c156a2120228c81b48fcc2088ea71d589f590a`

## Procedura di Aggiornamento Futuro (Nuove Versioni di llama.cpp / ggml)
Se in futuro si aggiornano `llama-server` e le librerie `ggml`:
1. Copiare i nuovi binari e librerie in `resources/native/`.
2. Verificare con `strings libggml.0.dylib | grep -E "Cellar|/opt|/usr/local"` la presenza di eventuali percorsi assoluti Homebrew.
3. Se presenti, applicare la sostituzione a lunghezza fissa con `.` imbottito di byte nulli (`\x00`), in modo che il caricamento avvenga sempre dalla directory di esecuzione del binario.
4. Eseguire `codesign --force --options runtime --timestamp --sign "<IDENTITÀ_DEVELOPER_ID>"` su tutte le librerie e verificare l'assenza di percorsi esterni con `DYLD_PRINT_LIBRARIES=1` o `vmmap`.
