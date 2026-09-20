---
title: "LIMEN Vault — Help delle schermate"
type: help
created_at: "2026-09-16"
updated_at: "2026-09-20"
tags: [limen-vault, reference, schermate, rag-locale, bm25]
---

# Help delle schermate

Torna all'indice: [[00_INDICE]]

Il menu laterale e le schede principali contengono le seguenti sezioni di lavoro:
**Panoramica** · **Chiedi** (Ricerca nel Vault & Chat AI) · **Documenti** (elenco e filtri formato) · **Memoria / Conoscenza** (note Markdown 01–10) · **Avanzate e Manutenzione** (Bozze & Proposte, Copie locali, Trasferimenti, Collegamenti AI & MCP con *Motore Semantico*, Compilatore, Stato di Sistema, Guida Vault).

---

## Benvenuto in LIMEN Vault (schermata iniziale)

| Elemento | Funzione |
| --- | --- |
| Percorso del Vault (cartella locale) | Percorso assoluto della cartella. Esempio precompilato: `~/Documents/VAULT` |
| **APRI VAULT ESISTENTE** | Valida in sola lettura una cartella LIMEN esistente |
| **CREA NUOVO VAULT** | Crea le 15 cartelle e i 3 file di sistema in una cartella nuova o vuota. Non sovrascrive file esistenti |
| Modalità anteprima nel browser | Avviso: non sei nell'app nativa macOS, le chiamate ai file e ai binari nativi sono disattivate |

Stati possibili del Vault (validazione in `vault.rs`):
- `NO_VAULT`: Nessun Vault selezionato.
- `NOT_ACCESSIBLE`: Cartella inesistente o permessi insufficienti.
- `INCOMPLETE`: Manca una cartella obbligatoria della struttura LIMEN.
- `INVALID`: File di sistema, manifesto, frontmatter YAML o collegamenti simbolici non validi.
- `READY` → **Pronto**: Struttura valida e registrata.

---

## Panoramica

| Scheda | Che cosa conta |
| --- | --- |
| File Markdown | Note `.md` presenti nelle cartelle di conoscenza (le copie in `SNAPSHOTS` sono escluse) |
| Fonti originali | Documenti e trascrizioni in `20_RAW_SOURCES` |
| File delle proposte | Bozze e revisioni salvate in `90_PROPOSALS` |
| Integrità SHA-256 | *Verificata* / *Non verificata* / *Differenze rilevate* |

Con *Differenze rilevate* compare un riquadro con **File modificati**, **File mancanti**, **File aggiunti non presenti nel manifesto**. Le modifiche legittime (nuove note approvate) producono differenze rispetto alla baseline: non è una diagnosi di perdita dati.

---

## Chiedi — Ricerca nel Vault & Domande AI

La schermata **Chiedi** unisce due strumenti complementari: la **Ricerca nel Vault** (Ricerca Ibrida locale) e le **Domande all'AI** (generazione con OpenAI).

### Ricerca nel Vault (Ricerca Ibrida BM25 + Semantica)

| Elemento | Funzione |
| --- | --- |
| Casella di ricerca | Termini, concetti, codici progetto, clienti, passaggi |
| **Ricerca Ibrida (Semantica + Lessicale)** | Casella di spunta: se attiva, fonde i risultati BM25 e vettoriali bge-m3 |
| Badge **RAG 100% LOCALE** | Compare quando il fornitore semantico attivo è locale e il servizio è in ascolto su loopback |
| Filtri | Categorie (01–10, RAW, Proposte) · Filtro cliente · Filtro progetto |
| **CANCELLA RICERCA** | Azzera il campo e i risultati |
| **AGGIORNA INDICE** | Ricostruisce l'indice lessicale locale `SEARCH_INDEX.json` con lock di sicurezza |
| Risultati | Elenco fino a 50 risultati con titolo, locator (es. `## Pagina 12` o `Paragrafi 34-36`), categoria, snippet di anteprima, percorso relativo nel Vault |
| **Apri nel lettore** | Apre il visualizzatore nativo del passaggio con verifica di integrità dell'impronta crittografica SHA-256 |

#### Modalità Degradata (Banner Giallo)
Se la casella *Ricerca Ibrida* è attiva ma il servizio locale `llama-server` non è in esecuzione, non risponde entro il timeout o è caduto:
- Compare il banner giallo `role="alert"`:  
  `⚠️ Modalità degradata (solo ricerca lessicale): il servizio semantico locale non è attivo o non ha risposto. I risultati sono calcolati esclusivamente tramite indice lessicale BM25. Nessun dato è uscito dal Mac.`
- Il badge dei risultati diventa **RAG LOCALE SPENTO (SOLO LESSICALE)**.
- L'app **non si blocca mai e non invia dati all'esterno**: garantisce la risposta tramite l'indice BM25 con normalizzazione sulla lunghezza.
- Per ripristinare il canale semantico vai in *Avanzate → Collegamenti AI & MCP → Motore semantico* e premi **AVVIA SERVIZIO LOCALE** (l'avviso non ha pulsanti). La ricerca non riavvia il servizio da sola; il ricalcolo della cache invece lo avvia automaticamente se è spento.

### Chiedi al Vault (Generazione con OpenAI)

| Elemento | Funzione |
| --- | --- |
| Modello OpenAI | Selettore del modello API (interroga OpenAI tramite la chiave nel Portachiavi) |
| Area domanda | Massimo 2.000 caratteri |
| Includi bozze indicizzate | Include nel contesto anche bozze non ancora approvate (le fonti RAW sono escluse) |
| **ANTEPRIMA FONTI** | Mostra localmente i documenti e i byte esatti che compongono il contesto. Nessun dato esce dal Mac durante l'anteprima |
| **INVIA A OPENAI LE FONTI MOSTRATE** | Trasmette domanda e sole fonti mostrate a OpenAI via HTTPS con timeout |
| **SALVA RISPOSTA COME BOZZA** | Salva risposta, fornitore, modello e citazioni in `80_AI_OUTPUTS` per la revisione |

---

## Avanzate → Collegamenti AI & MCP

Questa sezione racchiude le connessioni intelligenti del Vault.

### 1. Pannello «Motore semantico» (`SemanticEngineSettings.tsx`)
Configura il fornitore per il calcolo dei vettori semantici e la ricerca ibrida:

| Elemento | Descrizione e Funzionamento |
| --- | --- |
| Badge di stato | **RAG 100% LOCALE** (verde) oppure **OPENAI (RETE)** (blu) |
| Selettore fornitore | Scelta radio button esclusiva: **Locale (bge-m3, nessun dato esce dal Mac)** o **OpenAI (in rete)** |
| **Modello locale (bge-m3-Q8_0.gguf)** | Riporta lo stato (*INSTALLATO (SHA-256 OK)* / *Non installato*), percorso assoluto (`~/Library/Application Support/LIMEN Vault/models/`) e dimensione esatta (605,2 MB · 634.553.760 byte) |
| **SCARICA MODELLO (635 MB)** | Scarica il modello con barra percentuale di avanzamento e verifica automatica SHA-256; **ANNULLA SCARICAMENTO** lo interrompe |
| **SELEZIONA FILE GGUF DA DISCO…** | Selettore nativo file per importare un file `bge-m3-Q8_0.gguf` già scaricato, con verifica checksum |
| **Servizio locale di calcolo** | Riporta lo stato: *ATTIVO (PORTA n)* / *SPENTO* / *ERRORE*, con il modello caricato e l'esito del controllo `/health` |
| **AVVIA / ARRESTA SERVIZIO LOCALE** | Gestisce il ciclo di vita del processo `llama-server`. Il sistema alloca una porta libera loopback `127.0.0.1` a ogni avvio |
| **AGGIORNA STATO** | Interroga lo stato del processo e l'endpoint di salute locale |
| **Cache semantica del Vault** | Riporta `N passaggi indicizzati (D dim)` oppure `Nessun passaggio indicizzato`, e uno di tre avvisi: **Cache semantica assente**, **Disallineamento dimensioni vettore** (cache di un altro fornitore), **Cache semantica incompleta** (K passaggi su N da indicizzare: documenti nuovi o modificati). Se tutto è allineato: «Le dimensioni della cache (1024d) sono perfettamente allineate con il fornitore attivo» |
| **RICALCOLA CACHE SEMANTICA (1024 DIM)** | Avvia il calcolo (e il servizio locale, se spento). Mostra «Ricalcolo cache in corso… K/N passaggi», percentuale e barra; scrive in `00_SYSTEM/EMBEDDINGS_CACHE.staging.json` con salvataggio ogni 320 passaggi e non tocca la cache precedente finché il calcolo non è al 100%. Durata misurata: 9.458 passaggi in 49 minuti su M2 8 GB |
| **ANNULLA (I progressi parziali vengono conservati)** | Interrompe il calcolo salvando il punto raggiunto nello staging: la ripresa riparte da lì |

### 2. Collegamenti AI (Chiave OpenAI)
- **SALVA CHIAVE**: salva la chiave API OpenAI nel Portachiavi sicuro di macOS. Non viene mai salvata in chiaro nei file del Vault né esposta in variabili d'ambiente.
- **VERIFICA PORTACHIAVI**: verifica la presenza della chiave.
- **RIMUOVI CHIAVE**: cancella la chiave dal Portachiavi.

### 3. MCP in sola lettura · Vault corrente
- **ATTIVA MCP LOCALE**: avvia un server locale su `127.0.0.1:<porta>/mcp` con token segreto per consentire a client esterni (es. Codex, Claude Desktop) di consultare il Vault in sola lettura (`list_vaults`, `search_vault`, `read_document`).
- **REVOCA MCP**: spegne il server e invalida il token.

---

## Fonti (`20_RAW_SOURCES`)

- Pulsante verde **CARICA DOCUMENTI**: apre il selettore file nativo macOS per importare PDF, presentazioni, fogli Excel, immagini o trascrizioni.
- L'estrattore nativo `limen-extract` esegue OCR ed estrazione testo sul Mac, creando i passaggi nel catalogo `00_SYSTEM/VAULT_CATALOG.json`.
- I file originali rimangono immutabili e in sola lettura.

---

## Proposte (`90_PROPOSALS`)

- Elenco delle bozze generate da trascrizioni o risposte AI.
- **Nuova destinazione (.md)**: percorso proposto nella cartella corretta (es. `01_CLIENTS/acme.md`).
- Casella di controllo obbligatoria: *“Ho verificato questa revisione e la destinazione indicata”*.
- Pulsante verde **APPROVA REVISIONE MOSTRATA**: promuove la proposta a nota approvata in `01`–`10` con `status: approved` e registra la decisione con hash crittografico per fini di audit.

---

## Copie locali e Ripristino

- **CREA COPIA LOCALE**: genera uno snapshot immutabile in `00_SYSTEM/SNAPSHOTS/snap-…/` con manifesto crittografico SHA-256.
- **VERIFICA INTEGRITÀ**: ricalcola le impronte di tutti i file e segnala eventuali discrepanze (*Verificata*, *Incompleta*, *Danneggiata*).

---

## Trasferimenti (Cloudflare R2)

- **Canale Pubblicato (CRM)**: pubblica solo le note approvate delle cartelle `01`–`10` esplicitamente selezionate.
- **Canale Privato**: copia di sicurezza crittografata del Vault protetta da token dedicato, non leggibile dal CRM.
