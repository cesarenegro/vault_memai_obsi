# Piano di Implementazione FASE 7 — Installatori per Tester Esterni (macOS e Windows)

**Base di Partenza**: Commit `bb2031f` (branch `windows-build`)  
**Stato della Base**: Test Mac superati (205 lib + 19 bin = **224 test passati, 0 falliti**). Non ancora compilato né provato su Windows.  
**Modalità Corrente**: **SOLO PIANO DI IMPLEMENTAZIONE** — nessuna modifica al codice, nessun commit, nessuna compilazione di installatori eseguita.

---

## 1. Misurazione Requisito Minimo macOS (Punto R1)

Tutti i valori sono stati estratti direttamente dai binari presenti nel repository tramite `otool -l <file> | grep -E "LC_BUILD_VERSION|LC_VERSION_MIN_MACOSX" -A4`:

### Tabella dei Componenti e Versione Minima Attuale

| Componente | Percorso | Header Mach-O | `minos` Rilevato | `sdk` |
| :--- | :--- | :---: | :---: | :---: |
| **App Principale** | `target/release/limen-vault` | `LC_BUILD_VERSION` | **11.0** | 26.5 |
| **Estrattore Swift** | `resources/native/limen-extract` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Server Llama** | `resources/native/llama-server` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Libreria Crypto** | `resources/native/libcrypto.3.dylib` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Libreria SSL** | `resources/native/libssl.3.dylib` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Libreria OpenMP** | `resources/native/libomp.dylib` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Libreria GGML Base** | `resources/native/libggml-base.0.dylib` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Libreria GGML BLAS** | `resources/native/libggml-blas.so` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Backend GGML M1** | `resources/native/libggml-cpu-apple_m1.so` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Backend GGML M2/M3**| `resources/native/libggml-cpu-apple_m2_m3.so` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Backend GGML M4** | `resources/native/libggml-cpu-apple_m4.so` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Backend GGML Metal** | `resources/native/libggml-metal.so` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Libreria GGML** | `resources/native/libggml.0.dylib` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Libreria Llama Common**| `resources/native/libllama-common.0.dylib`| `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Libreria Llama Server**| `resources/native/libllama-server-impl.dylib`| `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Libreria Llama Core**| `resources/native/libllama.0.dylib` | `LC_BUILD_VERSION` | **26.0** | 26.5 |
| **Libreria MTMD** | `resources/native/libmtmd.0.dylib` | `LC_BUILD_VERSION` | **26.0** | 26.5 |

### Analisi dei Requisiti di Sistema (API & Frameworks)
1. **Tauri 2**:
   - Requisito ufficiale: macOS 10.15+ (Intel) / macOS 11.0+ (Apple Silicon `aarch64`).
   - Il binario compilato da Rust ha infatti come target nativo `minos 11.0`.
2. **Estrattore Swift (`apps/desktop/src-tauri/native/extract.swift`)**:
   - `PDFKit` (righe 20–39): `PDFDocument`, `page.string`, `page.thumbnail` disponibili da macOS 10.4+.
   - `Vision` (righe 4–13): `VNRecognizeTextRequest`, `recognitionLevel = .accurate` disponibili da macOS 10.15+.
   - **Vincolo Lingua Italiana (riga 10)**: `request.recognitionLanguages = ["it-IT", "en-US"]`. Il supporto al riconoscimento OCR della lingua italiana in Apple Vision richiede **macOS 11.0 (Big Sur)** (e perfezionato in macOS 11.5).
3. **Causa del `minos 26.0` attuale**:
   - L'ambiente di compilazione è macOS 26.3 (Darwin 25.3.0). In assenza del flag esplicito `-target` in `swiftc` e di `MACOSX_DEPLOYMENT_TARGET` in clang, gli strumenti Apple impostano il `minos` uguale alla versione del sistema host.

### Proposta per il Requisito Minimo (`minimumSystemVersion`)
- **Valore proposto per `tauri.conf.json`**: **`"12.0"`** (macOS Monterey).
  - *Motivazione*: Copre tutti i Mac con chip Apple Silicon (M1, M2, M3, M4) e garantisce la piena maturità delle API di `Vision` con dizionario OCR italiano e del motore WebKit di Tauri 2.
- **Procedura di abbassamento per i singoli componenti**:
  1. **`limen-extract`**:
     In `apps/desktop/src-tauri/build.rs` riga 5, sostituire la chiamata di compilazione:
     ```bash
     xcrun swiftc -O -target arm64-apple-macos12.0 native/extract.swift -o <output>
     ```
     *(Verificato con test di compilazione: produce `minos 12.0` con codice di uscita 0)*.
  2. **`llama-server` e librerie native `.dylib` / `.so`**:
     Impostare il deployment target con lo strumento ufficiale Apple `vtool` su ciascun binario:
     ```bash
     vtool -set-build-version macos 12.0 26.5 -replace apps/desktop/src-tauri/resources/native/<file>
     ```
     seguito da rifirma ad-hoc (`codesign --force --sign -`).
- **Dichiarazione di Rischio per Cesare**:
  - Non disponendo localmente di una macchina fisica con macOS 12 o 13, la compatibilità effettiva a runtime su versioni precedenti alla 26.3 va validata direttamente da un tester esterno munito di macOS 12/13/14, verificando l'assenza di crash di caricamento dinamico (`dyld`).

---

## 2. Verifica dei Fatti di Partenza (F1 — F7)

- **F1 (`tauri.conf.json`)**: Verificato `bundle.targets = ["app", "dmg", "nsis"]` e `minimumSystemVersion = "26.3"`. Sezione `bundle.windows` assente, `publisher` e `copyright` vuoti.
- **F2 (Certificati e Notarizzazione Mac)**:
  - Identità Developer ID verificata con `security find-identity -v -p codesigning`:
    `E01892F9C136DA67B393B9CD29AF97E369956968 "Developer ID Application: Arkitecna Hong Kong Limited (ZVGX4HFZC3)"`.
  - Profilo Portachiavi verificato con `xcrun notarytool history --keychain-profile LIMEN-M9`: profilo attivo e storico con esito `Accepted` per release precedenti.
- **F3 (Separazione Piattaforme Risorse Native)**:
  - `resources/native/` contiene attualmente 14 file per macOS (`.dylib`, `.so`, `llama-server` Mach-O). Se inclusi ciecamente nel pacchetto Windows, appesantiscono l'installer di oltre 25 MB di file inutilizzabili.
  - Su Windows `llama-server.exe` non è tracciato da git (`.gitignore` riga 34).
- **F4 (Risorse bundle esterne ad `apps/desktop`)**:
  - `vault-template/`: **INDISPENSABILE**. Utilizzato a runtime da `main.rs` (riga 93) in `create_vault` per generare la struttura iniziale delle note.
  - `HELP/`, `docs/GUIDA_UTENTE_LIMEN.md`, `manuale UI utente.txt`: Presenti e verificati su disco; costituiscono la documentazione a corredo del pacchetto installato.
- **F5 (Segnaposto `dist/index.html` in `build.rs`)**:
  - Il comando `tauri build` invoca tassativamente `beforeBuildCommand: "pnpm build"`, che compila la vera interfaccia React/Vite in `dist/`. La procedura di build verificherà la dimensione di `dist/index.html` assicurando che non sia il segnaposto di fallback (53 byte).
- **F6 (Compilazione `extract.swift`)**:
  - Confermato che `build.rs` invoca `swiftc` senza `-target`. La soluzione con `-target arm64-apple-macos12.0` risolve alla radice.
- **F7 (Chiave OpenAI dei Tester)**:
  - Confermato: i tester esterni useranno la propria chiave API OpenAI per le risposte con `gpt-4o`. Il modello locale `bge-m3` (634 MB) viene scaricato in automatico al primo avvio per la sola ricerca semantica vettoriale.

---

## 3. Piano Dettagliato macOS

### 3.1 Prerequisiti e Verifiche di Sola Lettura di Cesare
Prima di avviare la procedura, Cesare esegue da terminale i controlli di disponibilità delle credenziali:
```bash
# 1. Verifica presenza certificato Developer ID Application
security find-identity -v -p codesigning

# 2. Verifica connessione al servizio di notarizzazione Apple
xcrun notarytool history --keychain-profile LIMEN-M9
```

### 3.2 Modifiche di Configurazione e Build System
1. In `tauri.conf.json`:
   - Aggiornare `bundle.macOS.minimumSystemVersion: "12.0"`.
   - Impostare `publisher: "Arkitecna Hong Kong Limited"` e `copyright: "Copyright © 2026 Arkitecna Hong Kong Limited"`.
2. In `apps/desktop/src-tauri/build.rs`:
   - Aggiungere `-target arm64-apple-macos12.0` alla riga 5 nella compilazione di `extract.swift`.
3. Esclusione binari Windows:
   - Assicurare che nessun file `.exe` sia presente in `resources/native/`.

### 3.3 Passi di Compilazione e Confezionamento da Copia Pulita
```bash
# 1. Posizionamento nella root del progetto
cd "/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN"

# 2. Installazione dipendenze e build frontend
pnpm install --frozen-lockfile
pnpm --filter @limen-vault/desktop build

# 3. Compilazione release macOS
pnpm --filter @limen-vault/desktop tauri build --bundles app,dmg

# 4. Firma e Notarizzazione tramite script consolidato (adattamento package-v3.sh a V5)
export LIMEN_SIGN_IDENTITY="E01892F9C136DA67B393B9CD29AF97E369956968"
export LIMEN_NOTARY_PROFILE="LIMEN-M9"
export LIMEN_RELEASE_OUT="/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/.local/limen-v5-release"
./scripts/package-v5.sh prepare
./scripts/package-v5.sh package
./scripts/package-v5.sh finish
```

### 3.4 Validazione del Pacchetto Finale Mac
- `spctl --assess --type execute --verbose=4 "$APP"` $\rightarrow$ Deve riportare `accepted (source=Notarized Developer ID)`.
- `spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG"` $\rightarrow$ Deve riportare `accepted`.
- Calcolo hash SHA-256 del file `.dmg` finale salvato in `SHA256SUMS.txt`.

---

## 4. Piano Dettagliato Windows

### 4.1 Prerequisiti su PC Windows di Cesare
- Node.js, pnpm, Rust toolchain (MSVC) e NSIS installati.
- Reperimento o convalida del binario `llama-server.exe` per Windows in `apps/desktop/src-tauri/resources/native/llama-server.exe`.

### 4.2 Modifiche di Configurazione e Pulizia Risorse
1. In `tauri.conf.json`:
   - Configurare sezione `bundle.windows`:
     ```json
     "windows": {
       "certificateThumbprint": null,
       "digestAlgorithm": "sha256",
       "timestampUrl": ""
     }
     ```
   - Configurare `bundle.nsis`:
     ```json
     "nsis": {
       "installMode": "currentUser",
       "languages": ["Italian", "English"],
       "displayLanguageSelector": false
     }
     ```
2. **Esclusione preventiva file macOS da `resources/native/`**:
   - Creare uno script di pre-build o filtro che prima di `tauri build` su Windows rimuova/sposti i file `.dylib` e `.so` di macOS dalla cartella delle risorse native, includendo esclusivamente `llama-server.exe` ed eventuali dipendenze runtime `.dll`.

### 4.3 Passi di Compilazione da Copia Pulita su Windows
```powershell
# Eseguito da PowerShell sul PC di Cesare
cd "E:\Projects\vault_memai_obsi"

# 1. Installazione dipendenze
pnpm install --frozen-lockfile
pnpm --filter @limen-vault/desktop build

# 2. Compilazione installatore NSIS
pnpm --filter @limen-vault/desktop tauri build --bundles nsis

# L'output verrà generato in:
# E:\Projects\vault_memai_obsi\apps\desktop\src-tauri\target\release\bundle\nsis\LIMEN Vault V5_0.5.0_x64-setup.exe
```

### 4.4 Esperienza Tester su Windows e Schermata SmartScreen
Poiché l'eseguibile non è firmato con un certificato EV a pagamento:
1. Al doppio clic sull'installer, Windows Defender SmartScreen mostrerà il riquadro blu:
   > **"Windows ha protetto il PC"**  
   > *Microsoft Defender SmartScreen ha impedito l'avvio di un'app non riconosciuta. L'esecuzione di tale app potrebbe costituire un rischio per il PC.*
2. **Istruzioni obbligatorie da fornire al tester Windows**:
   - Cliccare sulla scritta sottolineata **"Ulteriori informazioni"**;
   - Cliccare sul pulsante **"Esegui comunque"** che comparirà in basso a destra;
   - Procedere con l'installazione guidata standard (nessun diritto di amministratore richiesto con modalità `currentUser`).

---

## 5. Procedura di Collaudo e Verifica dell'Installazione Pulita

Da eseguire sia su una postazione Mac pulita che su una postazione Windows pulita:

1. **Installazione**:
   - **Mac**: Apertura file `.dmg`, trascinamento di `LIMEN Vault V5.app` in `/Applications`. Verifica che al doppio clic l'app si apra direttamente senza avvisi di sicurezza bloccanti.
   - **Windows**: Esecuzione del file di setup `.exe`, superamento avviso SmartScreen, completamento procedura guidata e avvio dell'app da Start/Desktop.
2. **Primo Avvio**:
   - Apertura schermata iniziale con grafica Lime e titolo "LIMEN Vault V5 (0.5.0)".
   - Apertura o creazione di un nuovo Vault di test da template.
3. **Scaricamento Modello Semantico Locale (`bge-m3`)**:
   - Apertura pannello *Motore Semantico*;
   - Clic sul pulsante *"SCARICA MODELLO (635 MB)"*;
   - Verifica avanzamento barra, completamento download e passaggio automatico del badge a `INTEGRO (SHA-256 VERIFICATO)`.
4. **Avvio Servizio Locale**:
   - Clic su *"AVVIA SERVIZIO LOCALE"*;
   - Verifica passaggio di stato a `PRONTO` con PID e porta visualizzati a video.
5. **Configurazione Chiave OpenAI e Verifica Risposta**:
   - Inserimento chiave API OpenAI nel pannello Impostazioni / Portachiavi;
   - Passaggio alla scheda *Chiedi al Vault*;
   - Invio della domanda di prova: *"Quali argomenti sono trattati in questo vault?"*;
   - Ricezione della risposta in streaming con cursore pulsante, visualizzazione immediata delle fonti consultate e badge `CITATA` al completamento.

---

## 6. Breve Documento Guida per i Tester (`ISTRUZIONI_TESTER.md`)

```markdown
# Benvenuto nel Programma di Test di LIMEN Vault V5

Grazie per la tua disponibilità a testare LIMEN Vault V5 (versione 0.5.0).
L'applicazione è progettata per la gestione sicura della memoria aziendale e la consultazione aumentata da AI, con ricerca semantica locale al 100%.

### 1. Installazione
- **Su Mac**: Apri il file `.dmg` e trascina l'icona di LIMEN Vault V5 nella cartella Applicazioni. L'applicazione è ufficialmente autenticata e notarizzata da Apple.
- **Su Windows**: Fai doppio clic sul file `LIMEN Vault V5_0.5.0_x64-setup.exe`.
  *Nota di sicurezza*: Trattandosi di una versione preliminare di test, Windows mostrerà il messaggio blu "Windows ha protetto il PC". Clicca su **"Ulteriori informazioni"** e poi su **"Esegui comunque"**.

### 2. Primo Avvio e Configurazione
1. All'avvio, puoi aprire una cartella esistente o creare un nuovo Vault dimostrativo.
2. Vai nella scheda **Motore Semantico** e clicca su **"Scarica Modello (635 MB)"**: questo scaricherà il modello locale `bge-m3` utilizzato per indicizzare i tuoi documenti direttamente sul tuo computer, senza inviare dati all'esterno.
3. Al termine del download, avvia il servizio locale cliccando su **"Avvia Servizio Locale"**.
4. Nelle impostazioni, inserisci la tua **Chiave API OpenAI** personale: verrà custodita in modo sicuro nel Portachiavi di sistema (o Gestione Credenziali di Windows).

### 3. Cosa Provare
- Crea o importa documenti markdown / PDF nel tuo Vault.
- Fai domande nella scheda **Chiedi al Vault** sui contenuti dei tuoi documenti.
- Verifica la correttezza delle risposte generate con `gpt-4o` e la pertinenza delle fonti citate.
- Se desideri provare la modalità **100% Locale (Massima Privacy)**, attiva l'opzione apposita (le risposte verranno elaborate interamente dal tuo processore/scheda video).

### 4. Come Segnalare Anomalie
In caso di errori, rallentamenti o comportamenti inattesi, segnalaci:
- Sistema operativo e versione esatta (es. macOS 14.5 o Windows 11 23H2);
- Azione eseguita prima dell'anomalia;
- Se possibile, lo screenshot dell'errore visualizzato.
```

---

## 7. Decisioni da Sottoporre a Cesare (D2 — D4)

### Decisione D2: `llama-server` per Windows — Versione Ufficiale llama.cpp vs Build Docker Attuale
- **Opzione A (Consigliata)**: **Integrare la release ufficiale recente di `llama.cpp` (`llama-server.exe`) per Windows con supporto CUDA/AVX2**.
  - *Pro*: Supporta l'accelerazione GPU NVIDIA RTX 3060, rimuove la firma Docker Inc estranea, garantisce compatibilità con architetture GGUF recenti e allineamento perfetto con macOS.
  - *Contro*: Richiede di prelevare e posizionare la release ufficiale (o pacchetto con DLL runtime) prima del packaging.
- **Opzione B**: **Mantenere la build provvisoria di Docker Desktop già presente sul PC di Cesare**.
  - *Pro*: Nessun download aggiuntivo su Windows prima del test.
  - *Contro*: Non ufficiale, limitata nelle architetture supportate, firma Docker Inc visibile nelle proprietà del file.
- **Raccomandazione**: **Opzione A**. Per una release distribuita a tester esterni, l'adozione del binario ufficiale è fondamentale per stabilità e prestazioni.

---

### Decisione D3: Ordine di Rilascio — Prima Mac, Prima Windows o Entrambi
- **Opzione A (Consigliata)**: **Prima Mac, poi Windows**.
  - *Pro*: Su Mac il commit `bb2031f` è già collaudato al 100% con 224 test passati, ambiente pronto, certificato e profilo notarizzazione già validati. Permette di validare la catena di distribuzione completa su una base certa prima di affrontare la compilazione Windows.
  - *Contro*: I tester Windows riceveranno la build con un leggero differimento.
- **Opzione B**: **Entrambi contemporaneamente**.
  - *Pro*: Consegna simultanea a tutti i tester.
  - *Contro*: Il commit `bb2031f` su Windows deve ancora essere compilato e verificato da Cesare: un eventuale intoppo su Windows ritarderebbe inutilmente la consegna ai tester Mac.
- **Raccomandazione**: **Opzione A**.

---

### Decisione D4: Canale di Consegna dei Pacchetti ai Tester Esterni
- **Opzione A (Consigliata)**: **GitHub Releases (in repository privato con tester invitati) oppure Link di Download Diretto Protetto (es. Cloud Arkai/S3 con scadenza)**.
  - *Pro*: Evita di inviare allegati pesanti via email (il solo DMG pesa oltre 60 MB e l'installer Windows circa 80 MB), offre tracciamento download e hash SHA-256 chiaro.
  - *Contro*: Richiede il caricamento del file su uno spazio accessibile.
- **Opzione B**: **Cartella condivisa (Google Drive / OneDrive / Dropbox)**.
  - *Pro*: Molto immediato per Cesare, nessun setup di infrastruttura.
  - *Contro*: Alcuni antivirus aziendali o browser segnalano come sospetti i file eseguibili/DMG scaricati da cloud personali.
- **Raccomandazione**: **Opzione A** (link protetto o release dedicata).

---

## 8. Rischi e Punti Aperti

1. **Assenza di Mac con OS precedente per test locale**: Cesare dispone solo di macOS 26.3. La retrocompatibilità effettiva dell'app e dei binari nativi impostati a `minos 12.0` deve essere validata dal primo tester su macOS 12/13/14.
2. **Dimensioni pacchetto installer Windows**: Necessità di accertare che lo script di packaging Windows escluda tassativamente le librerie `.dylib` e `.so` di macOS per non raddoppiare inutilmente la dimensione dell'installer.
3. **Falsi positivi antivirus su Windows**: Senza certificato di firma Microsoft EV, l'installer non firmato genererà l'avviso SmartScreen; la guida fornita ai tester è fondamentale per evitare dubbi sull'affidabilità del software.
