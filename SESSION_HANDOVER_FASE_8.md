# SESSION HANDOVER — FASE 8: Ministral Locale e Rilascio LIMEN Vault v6Mini

- **Data:** 26 Settembre 2026
- **Repository:** `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`
- **Commit di partenza:** `efc42e78240c0b676d3a3941508bac764903dab8`
- **Commit di consegna:** `4658a54819257fb3fe3d423442c7c0ac0d073395` (tag: `fase8-ministral-fix`)
- **Stato Git Remoto:** Pushed su `origin/windows-build` e tag `fase8-ministral-fix` sincronizzati con `https://github.com/cesarenegro/vault_memai_obsi.git`.

---

## 1. Sintesi Esecutiva dei Lavori Svolti
In conformità alle decisioni vincolanti e alle 4 integrazioni obbligatorie approvate da Cesare, è stato completato e validato il rilascio di **LIMEN Vault v6Mini** (versione `0.6.0`, ID `dev.arkai.limenvault` invariato).

### Risultati delle 4 Integrazioni Obbligatorie:

1. **Integrazione 1 — Prova Reale 20 Domande Consecutive (Punto 2):**
   - Eseguita sul Mac di Cesare con il `llama-server` incluso nell'app in modalità **Solo Locale**.
   - **Esito:** **20 / 20 domande completate con successo**, **0 errori**.
   - **Dimensione finale log:** `/Users/cesare/Library/Application Support/LIMEN Vault/models/llama-llm.log` = **20.921 byte**.
   - Risolto definitivamente il rischio di blocco della pipe stderr reindirizzando i log su file dedicato.

2. **Integrazione 2 — Gestione Memoria su Mac 8 GB e Scelta Modello (Punto 9):**
   - **Output `--help` grezzo del binario incluso** verificato per `-np`, `-ctk`, `-ctv`, `-ngl`, `--fit`.
   - **Righe grezze di `llama-llm.log`:** `n_slots = 1`, `n_ctx_slot = 8192`, `kv_unified = false`.
   - **Esito Regola 8B vs 3B:** Il modello Ministral 3 8B (6.06 GB) supera il limite consigliato di memoria unificata Metal su 8 GB (~5.3 GB), causando errore `kIOGPUCommandBufferCallbackErrorOutOfMemory`. Conformemente alla regola approvata da Cesare, per i Mac con meno di 16 GB di RAM l'app impiega ufficialmente **Ministral 3 3B Instruct Q5_K_M**:
     - *Repo Hugging Face:* `mistralai/Ministral-3-3B-Instruct-2512-GGUF`
     - *URL download:* `https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512-GGUF/resolve/main/Ministral-3-3B-Instruct-2512-Q5_K_M.gguf`
     - *Dimensione:* `2.474.178.720` byte
     - *SHA-256:* `e23dd88b0e0951d3f5784d6d4092210cda2b006b251f33b226b283a6c9d1f6bb`
     - *Configurazione codice:* `-ngl 99` fisso (offload completo di tutti i 27 layer su GPU), cache KV quantizzata a 442 MiB (`-ctk q8_0 -ctv q8_0 -np 1`). Memoria totale occupata: ~2.8 GB (ampio margine di sicurezza).
   - **Metriche reali di generazione sul vault di Cesare:**
     - Prompt eval: **275.81 token/s** (3.63 ms/token)
     - Tempo al primo token (TTFT): **560.7 ms** (media su 3 domande: 987 ms, 159 ms, 536 ms)
     - Velocità di generazione: **24.92 token/s** (38.59 ms/token)
   - **Avviso RAM & UI Badge:** Sotto i 16 GB l'avviso dichiara l'uso del 3B ottimizzato. Il badge in calce nella UI mostra: `Ministral 3 3B Instruct Q5_K_M (Offline)`.

3. **Integrazione 3 — Errori Server Mai Presentati come Risposta Completata:**
   - In `apps/desktop/src-tauri/src/ai.rs`: status HTTP != 200, evento SSE con JSON `{"error": ...}`, o stream chiuso a 0 token impostano categoricamente `status: "error"` con il testo dell'errore (MAI `completed`).
   - Test unitari Rust `test_local_llm_stream_error_event_returns_status_error` e `test_local_llm_stream_empty_tokens_returns_status_error` passati con successo.

4. **Integrazione 4 — Tempi di Avvio e Costante Unica (Punto 3):**
   - Costante unica: `pub const MINISTRAL_STARTUP_TIMEOUT_SECS: u64 = 90;` in `llama_llm.rs`, applicata sia in `ensure_running()` sia nel loop `/health` di `start()`.
   - Tempo reale di avvio rilevato dai log: **~6 secondi**.

---

## 2. Esito delle 2 Precisazioni

1. **Precisazione 7 — Conteggio Token e Taglio Contesto:**
   - Funzione `prune_sources_for_context`: stima conservativa token `(caratteri * 1.20) / 3.5` (+20% di margine per il vocabolario italiano).
   - Riserva garantita di almeno **1500 token** per la generazione entro la finestra di **8192 token**.

2. **Precisazione 13 — Copia DMG e .gitignore:**
   - Percorso assoluto: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/USER INSTALL/LIMEN-Vault-v6Mini.dmg`.
   - Cartella esclusa da git alla riga 38 di `.gitignore` (`USER INSTALL/`).
   - Stato dell'albero di lavoro dopo la copia: **pulito al 100%** (`git status --short` vuoto).

---

## 3. Verifiche di Allineamento e Conformità

### Verifica Punto 12 (Nome e Versione):
Comando eseguito:
```bash
git grep -n -i -E "limen vault v5|\bV5\b|0\.5\.0" -- apps/desktop/src apps/desktop/src-tauri/tauri.conf.json apps/desktop/package.json apps/desktop/src-tauri/Cargo.toml IMPLEMENTATION/ISTRUZIONI_TESTER_MAC.md "MANUALE UTENTE.MD" "manuale UI utente.txt" "README INSTALLER MAC.txt" HELP
```
Output:
```text
README INSTALLER MAC.txt:4:Riferimento storico V5 (versione 0.5.0 precedente)	/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/.local/limen-v5-release/LIMEN-Vault-V5-0.5.0-arm64.dmg (51.430.042 byte)
```
Tutti i riferimenti di prodotto attivi sono allineati a **"LIMEN Vault v6Mini" 0.6.0**.

### Suite di Test Completa:
- `cargo test --lib`: **219 passati, 0 falliti**.
- Frontend bundle (`pnpm build`): **0 errori** (asset reali Vite/React generati).

---

## 4. Pacchetto di Rilascio DMG Notarizzato Apple

- **File Principale:** [`/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/USER INSTALL/LIMEN-Vault-v6Mini.dmg`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/USER%20INSTALL/LIMEN-Vault-v6Mini.dmg)
- **File nella cartella di build:** `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/.local/limen-v6mini-release/LIMEN-Vault-v6Mini.dmg`
- **Dimensione file:** `50.896.220` byte
- **Impronta SHA-256:** `170a20045ee7b2cf8ed5142b168de88245c7c57519e21233011c7aae704f4d68`

### Risultati dei 4 Comandi di Verifica Ufficiali:

1. `xcrun stapler validate "/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/.local/limen-v6mini-release/LIMEN-Vault-v6Mini.dmg"`:
   ```text
   The validate action worked!
   ```

2. `spctl --assess --type open --context context:primary-signature --verbose=4 "/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/.local/limen-v6mini-release/LIMEN-Vault-v6Mini.dmg"`:
   ```text
   accepted
   source=Notarized Developer ID
   ```

3. `shasum -a 256`:
   ```text
   170a20045ee7b2cf8ed5142b168de88245c7c57519e21233011c7aae704f4d68  /Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/.local/limen-v6mini-release/LIMEN-Vault-v6Mini.dmg
   170a20045ee7b2cf8ed5142b168de88245c7c57519e21233011c7aae704f4d68  /Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/USER INSTALL/LIMEN-Vault-v6Mini.dmg
   ```

4. `git rev-parse fase8-ministral-fix`:
   ```text
   4658a54819257fb3fe3d423442c7c0ac0d073395
   ```

---

## 5. Stato dei File e Prossimi Passi
- Nessun processo residuo o demone lasciato attivo.
- L'app è pronta per il test aprendo il file DMG in `USER INSTALL/LIMEN-Vault-v6Mini.dmg`.
