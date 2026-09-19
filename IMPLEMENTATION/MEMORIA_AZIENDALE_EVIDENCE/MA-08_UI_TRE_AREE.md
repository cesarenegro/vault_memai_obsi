# Evidenza di Collaudo MA-08: Riorganizzazione UI/UX in 3 Aree Funzionali

## Obiettivo
Semplificare radicalmente la superficie utente di LIMEN Vault v3 eliminando badge tecnici interni (es. M3, M10, DOCS), exponendo chiaramente 3 aree operative primarie (`Chiedi`, `Documenti`, `Memoria`), un'area di configurazione secondaria (`Avanzate`), e rendendo accessibile il pulsante di caricamento globale evidenziato in colore lime (`#c8ff00`).

## Implementazione Verificata

1. **Sidebar Strutturata**:
   - Pulsante Primario Globale: `CARICA DOCUMENTI` (`bg-[#c8ff00] text-black font-black uppercase tracking-wider`).
   - 3 Voci Principali:
     - `Chiedi` (icona Search / Sparkles): Interfaccia per fare domande alla memoria aziendale con citazioni contestuali.
     - `Documenti` (icona FileText): Inventario unificato delle fonti grezze (PDF, DOCX, XLSX, TXT, MD) con conteggi reali.
     - `Memoria` (icona Database / Brain): Esplorazione delle 10 categorie di conoscenza aziendale (`01_CLIENTS` ... `10_DELIVERY`).
   - Separatore visivo pulito e sezione secondaria:
     - `Avanzate` (icona Settings): Raggruppa in schede secondarie le funzioni operative avanzate (Proposte M7, Snapshot M10, Trasferimenti, Impostazioni API, Compilatore manuale, Diagnostica di sistema, Guida).

2. **Area Documenti con Contatori Reali**:
   - Contatori verificati derivati da `syncCatalog`:
     - Fonti Acquisite (`totalRawSources` o `totalDocuments`)
     - Pronte per Ricerca (`readyDocuments`)
     - Passaggi Estratti (`totalPassages`)
   - Eliminato il difetto dei contatori a zero (0/0) causato dalla scansione ristretta ai soli file di testo.
   - Area di Drag-and-Drop attiva per il caricamento diretto dei file (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.md`, `.csv`).
   - Filtri per formato (`Tutti`, `PDF`, `DOCX`, `XLSX`, `TXT/MD`, `Altro`) e per stato (`Tutti`, `Pronto`, `In corso`, `Attenzione`).
   - Azioni su riga: `Leggi nel Vault` (modal di lettura unificata con hash/revisione verificati), `Apri originale` (apertura con applicazione di sistema), `Mostra nel Finder`.

3. **Verifica Compilazione e Tipi**:
   - `tsc --noEmit` su `@limen-vault/desktop`: PASS con 0 errori.
   - `pnpm --filter @limen-vault/desktop build`: Bundle generato in 2.41s.
