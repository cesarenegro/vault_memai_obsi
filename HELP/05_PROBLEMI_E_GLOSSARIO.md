---
title: "LIMEN Vault — Problemi comuni e glossario"
type: help
created_at: "2026-09-16"
updated_at: "2026-09-20"
tags: [limen-vault, troubleshooting, glossario, rag-locale, bm25]
---

# Problemi comuni e glossario

Torna all'indice: [[00_INDICE]]

**Novità v3:** RAG 100% Locale, Ricerca Ibrida BM25 con normalizzazione sulla lunghezza e Modalità Degradata automatica.

---

## Messaggi dell'app e cosa fare

| Messaggio | Causa | Cosa fare |
| --- | --- | --- |
| Modalità degradata (solo ricerca lessicale)... | Il servizio semantico locale `llama-server` non risponde o è spento | Clic su **Riavvia Servizio Locale** nel banner, oppure vai in *Avanzate → Collegamenti AI & MCP → Motore semantico* e premi **AVVIA SERVIZIO LOCALE**. Nessun dato esce dal Mac |
| Le dimensioni della cache (1024d/1536d) non sono allineate... | Cambio di fornitore (es. da OpenAI a Locale bge-m3) o nuovi documenti aggiunti | Nel pannello *Motore semantico*, premi **RICALCOLA CACHE SEMANTICA**. Il ricalcolo usa uno staging atomico senza cancellare la cache in uso |
| llama-server uscito con codice exit status: 1 | Problema all'avvio del binario o modello mancante/danneggiato | Controlla il log diagnostico in `~/Library/Application Support/LIMEN Vault/models/llama-server.log`. Verifica l'integrità del modello (deve essere *INSTALLATO (SHA-256 OK)*) |
| Download del modello fallito o interrotto | Connessione di rete persa durante il download di `bge-m3-Q8_0.gguf` (~605 MB) | Riprova il download oppure copia manualmente il file in `~/Library/Application Support/LIMEN Vault/models/` e usa **SELEZIONA FILE GGUF LOCALE** |
| Configura la chiave API nelle Impostazioni | Nessuna chiave OpenAI salvata (necessaria solo per *Chiedi al Vault* generativo) | Impostazioni → SALVA CHIAVE (non serve per il RAG locale bge-m3) |
| Indica un modello API disponibile nel tuo account | Campo modello OpenAI vuoto | Scrivi l'identificativo del modello (es. `gpt-4o`) |
| Accesso al Portachiavi negato o non disponibile | macOS ha negato l'accesso alle chiavi | Riprova e autorizza nella finestra di dialogo di sicurezza macOS |
| Anteprima scaduta. Seleziona nuovamente le fonti | Trascorsi più di 300 s dall'anteprima locale | Premi nuovamente **ANTEPRIMA FONTI** |
| Una fonte è cambiata dopo l'anteprima… | Una nota è stata modificata durante l'attesa | Genera una nuova anteprima |
| Il Vault non ha superato la validazione | Struttura cartelle mancante o frontmatter non valido | Leggi gli errori specifici elencati nella schermata iniziale |

---

## Situazioni tipiche

| Sintomo | Verifica | Soluzione |
| --- | --- | --- |
| Compare il banner giallo di Modalità Degradata | La casella *Ricerca Ibrida* è spuntata ma il processo locale è offline | Normale comportamento di sicurezza: la ricerca continua in sola modalità BM25. Clicca su **Riavvia Servizio Locale** |
| Il servizio locale non parte | C'è un altro processo in ascolto o modello assente | Premi **AGGIORNA STATO** nel Motore Semantico. Se necessario, riavvia l'applicazione LIMEN |
| Ricerca vuota o risultati parziali | Indice non aggiornato o filtri cliente/progetto attivi | Rimuovi i filtri e premi **AGGIORNA INDICE** in Ricerca |
| Ricalcolo cache semantica interrotto | L'app è stata chiusa durante l'indicizzazione dei passaggi | Riapri l'app e premi **RICALCOLA CACHE**: il processo riprende dallo staging atomico senza ripartire da zero |
| Il Vault non si apre | Percorso assoluto corretto? Cartella con 15 cartelle LIMEN? | Correggi il percorso. Non cancellare file per forzare l'apertura |
| CREA NUOVO VAULT rifiuta la cartella | La cartella selezionata esiste già e contiene file | Scegli una cartella nuova o vuota |
| APPROVA respinta in Proposte | Destinazione fuori categoria, file già esistente, estensione non `.md` | Correggi il percorso proposto; spunta la casella di verifica obbligatoria |
| *Differenze rilevate* in Panoramica | Note nuove o modificate rispetto al manifesto precedente | Se le modifiche sono intenzionali è normale. Crea una nuova copia locale |
| Obsidian non si apre | Percorso applicazione Obsidian | Installa Obsidian o apri prima Obsidian con *Open folder as vault* |

---

## Cose da non fare

- Non modificare manualmente i file in `00_SYSTEM/` (inclusi `EMBEDDINGS_CACHE.json`, `SEARCH_INDEX.json`, `SYNC_PROFILE.json`).
- Non inserire URL esterni in `SYNC_PROFILE.json`: il fornitore locale accetta unicamente connessioni di loopback `127.0.0.1`.
- Non tradurre i nomi tecnici delle cartelle o delle proprietà YAML (`client`, `type`, `status: approved`).
- Non cancellare file `.staging.json` o file temporanei `.pending-*` durante il calcolo della cache o dei trasferimenti.
- Non disattivare Gatekeeper né rimuovere la quarantena con comandi di bypass non verificati.

---

## Glossario

| Termine | Significato |
| --- | --- |
| **RAG 100% Locale** | Retrieval-Augmented Generation interamente eseguito sul Mac a rete zero, senza dipendere da server cloud per la ricerca. |
| **bge-m3** | Modello di intelligenza artificiale per embedding multilingua a 1024 dimensioni (BAAI/bge-m3), quantizzato in formato `Q8_0.gguf` (605,2 MB). |
| **llama-server** | Servizio nativo integrato nel pacchetto dell'applicazione per l'esecuzione locale e accelerata del modello bge-m3 su socket loopback `127.0.0.1`. |
| **BM25** | Algoritmo probabilistico di ranking lessicale con parametri $k_1=1,2$ e $b=0,75$, frequenze reali dei termini e normalizzazione sulla lunghezza del documento (`dl/avgdl`). |
| **Ricerca Ibrida** | Fusione intelligente tra punteggio lessicale BM25 e punteggio semantico vettoriale con formula $F_2$, coalescenza identificativi e bonus di concordanza esatta. |
| **Modalità Degradata** | Meccanismo di ripiego automatico: se il servizio semantico è offline, la ricerca continua istantaneamente in sola modalità BM25 esponendo un banner giallo di avviso. |
| **Staging Cache** | File temporaneo sicuro (`00_SYSTEM/EMBEDDINGS_CACHE.staging.json`) che raccoglie i nuovi vettori progressivamente senza alterare la cache in uso fino al completamento al 100%. |
| **Chunking** | Segmentazione automatica dei testi estratti in passaggi da circa 1.200 caratteri con locator di pagina o paragrafo e contestualizzazione di metadati. |
| **Locator** | Indicazione precisa dell'origine del passaggio all'interno del documento (es. `## Pagina 3` o `Paragrafi 12-14`). |
| **Vault** | Cartella del Mac strutturata secondo le specifiche LIMEN, pienamente compatibile con Obsidian. |
| **Frontmatter** | Blocco iniziale di proprietà YAML in testa a ogni file Markdown, compreso tra due righe `---`. |
| **Fonte originale (RAW)** | Documento memorizzato in `20_RAW_SOURCES`, conservato integro e in sola lettura. |
| **Proposta** | Bozza di conoscenza in `90_PROPOSALS/` in attesa di revisione e approvazione umana con tracciamento della cronologia. |
| **SHA-256** | Impronta crittografica digitale che certifica l'integrità matematica esatta di file, passaggi e copie di sicurezza. |
| **Copia locale (snapshot)** | Backup certificato e immutabile creato all'interno di `00_SYSTEM/SNAPSHOTS/`. |
| **MCP** | Protocollo Model Context Protocol con cui client esterni autorizzati consultano il Vault in sola lettura. |
