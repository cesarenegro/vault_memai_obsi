---
title: "LIMEN Vault — Help delle schermate"
type: help
tags: [limen-vault, reference]
---

# Help delle schermate

Torna all'indice: [[00_INDICE]]

Il menu laterale contiene undici sezioni, in quest'ordine (da `App.tsx`):
Panoramica · Chiedi al Vault · Conoscenza · Fonti · Ricerca · Risposte AI · Proposte · Copie locali · Trasferimenti · Sistema · Impostazioni.
Accanto ad alcune voci compaiono le sigle **M6**, **M3**, **M10**: sono i codici interni delle fasi di sviluppo, non indicano stati o errori.

---

## Benvenuto in LIMEN Vault (schermata iniziale)

| Elemento | Funzione |
| --- | --- |
| Percorso del Vault (cartella locale) | Percorso assoluto della cartella. Esempio nel campo: `/Users/nome/Documents/IL_MIO_VAULT` |
| **APRI VAULT ESISTENTE** | Valida in sola lettura una cartella LIMEN esistente |
| **CREA NUOVO VAULT** | Crea le 15 cartelle e i 3 file di sistema in una cartella nuova o vuota. Non sovrascrive |
| Modalità anteprima nel browser | Avviso: non sei nell'app nativa, le operazioni sui file sono disattivate |

Stati possibili del Vault (validazione in `vault.rs`):

| Stato tecnico | Significato |
| --- | --- |
| `NO_VAULT` | Nessun Vault selezionato |
| `NOT_ACCESSIBLE` | Cartella inesistente o non leggibile |
| `INCOMPLETE` | Manca una cartella obbligatoria |
| `INVALID` | File di sistema, manifesto, frontmatter o collegamenti simbolici non validi |
| `READY` → *Pronto* | Struttura valida |

*Pronto* certifica la **struttura**, non l'integrità dei contenuti né la pubblicazione nel CRM.

---

## Panoramica

| Scheda | Che cosa conta |
| --- | --- |
| File Markdown | Tutti i `.md` del Vault, inclusi quelli di sistema (le copie in `SNAPSHOTS` sono escluse) |
| Fonti originali | Documenti in `20_RAW_SOURCES` |
| File delle proposte | Bozze e revisioni salvate (file, non decisioni in attesa) |
| Integrità SHA-256 | *Verificata* / *Non verificata* / *Differenze rilevate* |

Con *Differenze rilevate* compare un riquadro con **File modificati**, **File mancanti**, **File aggiunti non presenti nel manifesto**.
Le modifiche legittime (note nuove) producono differenze: non è una diagnosi di perdita dati.

**Accesso rapido**: gli otto pulsanti categoria aprono la sezione Conoscenza; la categoria va poi scelta nella barra in alto (il pulsante non la preseleziona).
**Integrazione AI** → pulsante **Chiedi al Vault**.

---

## Chiedi al Vault

| Elemento | Funzione |
| --- | --- |
| Modello OpenAI | Identificativo del modello API. La disponibilità è verificata da OpenAI solo all'invio |
| Domanda | Massimo 2.000 caratteri |
| Includi bozze indicizzate e note non approvate | Se spuntata, entrano anche bozze. Le fonti RAW sono sempre escluse |
| **ANTEPRIMA FONTI** | Prepara il contesto locale e mostra i documenti che verranno inviati. Nessun dato esce dal Mac |
| **INVIA A OPENAI LE FONTI MOSTRATE** | Trasmette domanda e fonti mostrate a OpenAI |
| **ANNULLA** | Interrompe l'attesa locale; una richiesta già inviata può essere elaborata comunque |
| **SALVA RISPOSTA COME BOZZA** | Salva risposta, fornitore, modello e citazioni in `80_AI_OUTPUTS` |

Dettagli verificati nel codice (`ai.rs`): l'anteprima scade dopo 300 secondi; la chiamata HTTPS ha un limite di 30 secondi; cambiare domanda, modello o spunta invalida l'anteprima.

---

## Conoscenza

Barra categorie: Clienti (`01_CLIENTS`), Progetti (`02_PROJECTS`), Marchi (`03_BRANDS`), Posizionamento (`04_POSITIONING`), Confezionamento (`05_PACKAGING_KNOWLEDGE`), Metodi (`06_METHODS`), Casi studio (`07_CASE_STUDIES`), Ricerca di mercato (`08_MARKET_RESEARCH`), Concorrenti (`09_COMPETITORS`), Contenuti approvati (`10_APPROVED_OUTPUTS`).

- Legge i file direttamente, senza indice e senza rete.
- **AGGIORNA CONOSCENZA** dopo modifiche in Obsidian.
- Categoria vuota → *Nessuna nota Markdown in questa categoria.*
- Anteprima di categoria limitata a 8 MiB.
- Sola lettura: per scrivere usa Obsidian.

---

## Fonti

| Elemento | Funzione |
| --- | --- |
| **AGGIORNA FONTI** | Rilegge `20_RAW_SOURCES` |
| Colonne | Percorso della fonte · Estensione · Dimensione · Stato · Azione |
| Stato *Da compilare* / *Compilata* / *Modificata* / *Non supportata* | Nessuna compilazione / compilazione registrata / fonte cambiata dopo la compilazione / formato non gestito |
| **Compila bozza** | Compila una fonte |
| **COMPILA TUTTE LE FONTI** | Compila l'elenco; *Riepilogo compilazione* separa i risultati |

Formati supportati (`compiler.rs`): `.md`, `.markdown`, `.txt`, `.html`, `.htm`. PDF, Word ecc. non sono compilati.
Le bozze vanno in `90_PROPOSALS` con `status: draft`.

---

## Ricerca

| Elemento | Funzione |
| --- | --- |
| **AGGIORNA INDICE DI RICERCA** | Ricostruisce l'indice locale (non si aggiorna da solo) |
| Stato indice | Numero documenti e data dell'ultima indicizzazione |
| Campo principale | Parole, titoli, proprietà, etichette |
| Filtri | Tutte le categorie · Filtra per cliente · Filtra per progetto · Filtra per etichette (separate da virgole) · Filtra per stato (Approvata, Bozza, In revisione, Archiviata) |
| Risultati | Titolo, categoria, rilevanza, percorso, estratto |

I filtri confrontano i metadati delle note: se la nota non ha il campo `client`, non uscirà filtrando per cliente.
Un indice danneggiato viene segnalato e conservato, non azzerato.

---

## Risposte AI

| Elemento | Funzione |
| --- | --- |
| **AGGIORNA** | Rilegge le risposte salvate |
| Dettaglio | Testo, fonti, provenienza, cronologia revisioni |
| Categoria + **CREA PROPOSTA DALLA RISPOSTA SALVATA** | Crea una copia da revisionare in Proposte |
| **RECUPERA OPERAZIONE INTERROTTA** | Completa o chiude un'operazione locale rimasta a metà |

---

## Proposte

| Elemento | Funzione |
| --- | --- |
| Importa una bozza compilata da revisionare | Categoria → apri bozza → **IMPORTA BOZZA MOSTRATA** (copia con provenienza, l'originale resta) |
| Stato *Da revisionare* / *Approvata* / *Rifiutata* | Stato della decisione |
| Testo della nuova revisione + **SALVA NUOVA REVISIONE (CONSERVA LA PRECEDENTE)** | Nuova revisione; le precedenti restano |
| Confronta il testo attuale con la revisione proposta | Testo attuale / Testo proposto |
| Nuova destinazione (.md) | Percorso relativo nella cartella della categoria, file non esistente |
| Ho verificato questa revisione e la destinazione indicata. | Conferma obbligatoria |
| **APPROVA REVISIONE MOSTRATA** | Scrive la nota con `status: approved` |
| Motivo del rifiuto + **RIFIUTA REVISIONE MOSTRATA** | Registra il rifiuto, non cancella |
| **RECUPERA OPERAZIONE INTERROTTA** | Come in Risposte AI |

Regole di destinazione (`proposals.rs`): la cartella deve essere quella della categoria (`client` → `01_CLIENTS`, …, `approved_output` → `10_APPROVED_OUTPUTS`), il file deve terminare in `.md`, non può esistere già con contenuto diverso, `20_RAW_SOURCES` è escluso, i collegamenti simbolici sono rifiutati, e se la revisione è cambiata dopo la visualizzazione l'approvazione viene respinta.

---

## Copie locali

| Elemento | Funzione |
| --- | --- |
| Nota facoltativa per la copia... | Descrizione libera |
| **CREA COPIA LOCALE** | Copia verificata in `00_SYSTEM/SNAPSHOTS/snap-…/` |
| **VERIFICA INTEGRITÀ** | Ricalcola le impronte del Vault e delle copie |
| Colonne | ID copia · Data di creazione · Nota / Descrizione · Numero di file · Stato |
| Stato | *Verificata (SHA-256)* · *Incompleta* (manifesto assente) · *Danneggiata* |

Non esiste un pulsante di ripristino. Una copia sullo stesso disco non protegge da un guasto del disco.
Un arresto forzato può lasciare cartelle `.pending-*`: sono ignorate.

---

## Trasferimenti

Due schede: **Operazioni Trasferimento** e **Impostazioni Copia cloud**.

**Impostazioni Copia cloud**

| Elemento | Funzione |
| --- | --- |
| Codice di collegamento fornito dall'amministratore | Testo JSON con `endpoint` e `token` (campo nascosto) |
| **Collega archivio** | Salva configurazione e token (nel Portachiavi) e prova il collegamento |
| Bucket R2 di destinazione | Sola lettura; prefisso isolato `limen/` |
| **Test Connessione** | Prova il collegamento senza inviare contenuti |
| **Disconnetti** | Rimuove configurazione e token da questo Mac. Non ritira pubblicazioni |

**Operazioni Trasferimento**

| Operazione | Contenuto | Visibile al CRM |
| --- | --- | --- |
| **Pubblica conoscenza** | Solo note approvate in `01`–`10`, selezionate da te | Sì |
| **Carica versione** | Copia privata: note, fonti, revisioni | No |
| **Scarica copia** | Recupero in una **nuova** cartella `LIMEN-copy-<id>` | — |

Altri controlli: **Versioni precedenti da recuperare** → **Carica versioni** → elenco (*Ultima versione* o data — numero file); **Conferma ed Esegui**; **Annulla trasferimento**; **Riprendi trasferimento interrotto**; **Ritira pubblicazione** → **Conferma ritiro** / **Mantieni pubblicazione**.

Stati cloud: *Pronto*, *Non configurato*, *Non connesso*, *Disattivato*, *Verifica in corso*, *Autenticazione richiesta*, *Trasferimento in corso*, *Non riuscito*, *Conflitto*, *Collegamento in corso*, *Scaduto*, *Revocato*.

Ogni nuova pubblicazione **sostituisce** la precedente selezione: includi anche le note che vuoi mantenere pubblicate.
Limiti del servizio (`docs/SYNC_PROTOCOL.md`): 1.000 documenti per versione, 8 MiB per file, 256 MiB totali.

---

## Sistema

Tabella *Stato del sistema locale*: Cartella del Vault · Applicazione Obsidian (*Rilevata e disponibile* / *Non installata o non rilevata*) · Motore delle copie locali · Ambiente di esecuzione (*Applicazione nativa macOS* / *Anteprima nel browser*) · Servizi remoti.
La riga *Servizi remoti* è un testo fisso: **non** controlla MEMAI, CRM o R2. Per R2 usa **Test Connessione**.

---

## Impostazioni

**Collegamenti AI**

| Elemento | Funzione |
| --- | --- |
| Chiave API OpenAI + **SALVA CHIAVE** | Salva nel Portachiavi macOS |
| **VERIFICA PORTACHIAVI** | Controlla che la chiave ci sia (non che sia valida) |
| **RIMUOVI CHIAVE** | Elimina la chiave usata da LIMEN |

**MCP in sola lettura · Vault corrente**

| Elemento | Funzione |
| --- | --- |
| **ATTIVA MCP LOCALE** | Avvia un endpoint `http://127.0.0.1:<porta>/mcp` con token e ID Vault |
| Mostra il token di collegamento — mantienilo riservato | Rivela il token |
| **REVOCA MCP** | Ferma l'endpoint e invalida il token |

Strumenti esposti (`mcp.rs`): `list_vaults`, `search_vault`, `read_document`. Nient'altro: sola lettura, solo note approvate e indicizzate. Il riavvio dell'app spegne l'MCP.

**ChatGPT Business · tunnel privato** (facoltativo)

| Elemento | Funzione |
| --- | --- |
| ID tunnel · ID organizzazione · Chiave di esecuzione del tunnel | Dati forniti dalla configurazione OpenAI Business |
| **SALVA CHIAVE TUNNEL** | Salva la chiave nel Portachiavi |
| **AVVIA TUNNEL BUSINESS** | Avvia il tunnel; il Mac e l'app devono restare accesi |
| **ARRESTA TUNNEL BUSINESS** | Blocca nuove letture. Scollega anche il plugin in ChatGPT per revocare lato remoto |

Il tunnel non si avvia da solo all'apertura dell'app; alla chiusura dell'app viene arrestato.

**Impostazioni del Vault**: il campo *Cartella locale del Vault* mostra il percorso in uso. Non modificarlo: cambia il testo senza validare né spostare nulla. Per cambiare Vault riavvia l'app.

---

## Menu nativi macOS

Voci descritte nel manuale UI del 13 settembre 2026 (menu standard macOS, non ricontrollate nel codice): LIMEN Vault (Informazioni, Servizi, Nascondi, Esci) · File (Chiudi finestra) · Modifica (Annulla, Ripeti, Taglia, Copia, Incolla, Seleziona tutto — solo per il testo) · Vista (Schermo intero) · Finestra · Aiuto.
