---
title: "LIMEN Vault — Workflow utente"
type: help
tags: [limen-vault, workflow, mermaid]
---

# Workflow utente

Torna all'indice: [[00_INDICE]]

I diagrammi usano Mermaid e si vedono direttamente in Obsidian.

---

## W0 — Il ciclo di vita di un contenuto

```mermaid
stateDiagram-v2
  [*] --> Grezzo: file in 20_RAW_SOURCES
  Grezzo --> NoteAutomatiche: Conversione e classificazione
  NoteAutomatiche --> Wiki: Sintesi con fonti
  Wiki --> RicercaAI: Indicizzazione
  Grezzo --> Bozza: Compilazione manuale facoltativa
  [*] --> RispostaAI: Chiedi al Vault / SALVA RISPOSTA COME BOZZA
  RispostaAI --> Proposta: Risposte AI / CREA PROPOSTA
  Bozza --> Proposta: Proposte / IMPORTA BOZZA MOSTRATA
  Proposta --> Proposta: SALVA NUOVA REVISIONE
  Proposta --> Rifiutata: RIFIUTA REVISIONE MOSTRATA
  Proposta --> Approvata: APPROVA REVISIONE MOSTRATA
  [*] --> Approvata: nota scritta a mano in Obsidian (01-10)
  Approvata --> Pubblicata: Trasferimenti / Pubblica conoscenza
  Pubblicata --> Ritirata: Ritira pubblicazione
```

## W0b — Chi può scrivere dove

```mermaid
flowchart LR
  U((Utente in Obsidian)) --> K[01-10 Conoscenza]
  U --> R[20_RAW_SOURCES]
  AUTO[Automazione attivata] --> N[01-09 Note e wiki, status review]
  AUTO -. legge .-> R
  C[Compilatore manuale] --> P[90_PROPOSALS]
  AI[OpenAI] --> O[80_AI_OUTPUTS]
  AP{Approvazione umana in Proposte} --> K
  P --> AP
  O --> P
  C -. legge .-> R
  AI -. legge solo fonti mostrate .-> K
```

---

## W1 — Primo avvio

```mermaid
flowchart TD
  A[Avvia LIMEN Vault] --> B{Anteprima nel browser?}
  B -- Sì --> B1[Apri l'app macOS nativa]
  B -- No --> C[Inserisci percorso assoluto]
  C --> D{La cartella è un Vault LIMEN?}
  D -- Sì --> E[APRI VAULT ESISTENTE]
  D -- No, cartella nuova/vuota --> F[CREA NUOVO VAULT]
  E --> G{Stato}
  F --> G
  G -- Pronto --> H[Panoramica]
  G -- Non accessibile / Incompleto / Non valido --> I[Leggi errori, correggi, riprova. Non cancellare file]
```

## W2 — Collegare Obsidian

```mermaid
sequenceDiagram
  actor U as Utente
  participant L as LIMEN
  participant O as Obsidian
  U->>L: Apri in Obsidian
  L->>O: apre il Vault (se già registrato)
  alt Vault non registrato
    O-->>U: selettore Vault
    U->>O: Open folder as vault, scegli cartella
    U->>L: Apri in Obsidian (di nuovo)
    L->>O: apertura diretta
  end
```

## W3 — Scrivere una nota e ritrovarla

```mermaid
flowchart LR
  A[Apri in Obsidian] --> B[Scrivi nota con frontmatter in 01-10]
  B --> C[LIMEN: Conoscenza > categoria > AGGIORNA CONOSCENZA]
  C --> D[Ricerca > AGGIORNA INDICE DI RICERCA]
  D --> E[Cerca con parole e filtri]
```

## W4 — Percorso manuale facoltativo da testo a conoscenza approvata

```mermaid
flowchart TD
  A[Copia .md .txt .html in 20_RAW_SOURCES dal Finder] --> B[Fonti > AGGIORNA FONTI]
  B --> C{Stato}
  C -- Non supportata --> C1[Usa caricamento automatico per PDF e Office]
  C -- Da compilare / Modificata --> D[Compila bozza o COMPILA TUTTE LE FONTI]
  D --> E[Bozza in 90_PROPOSALS, status draft]
  E --> F[Proposte > Importa una bozza compilata > categoria > IMPORTA BOZZA MOSTRATA]
  F --> G[Leggi testo, fonti, cronologia]
  G --> H{Serve correggere?}
  H -- Sì --> H1[SALVA NUOVA REVISIONE] --> G
  H -- No --> I{Decisione}
  I -- Rifiuta --> J[Motivo > RIFIUTA REVISIONE MOSTRATA]
  I -- Approva --> K[Nuova destinazione .md > spunta conferma > APPROVA]
  K --> L[Conoscenza: aggiorna]
  L --> M[Ricerca: aggiorna indice]
```

## W5 — Domanda AI con controllo delle fonti

```mermaid
sequenceDiagram
  actor U as Utente
  participant L as LIMEN (locale)
  participant K as Portachiavi macOS
  participant AI as OpenAI
  U->>L: Impostazioni > SALVA CHIAVE
  L->>K: salva chiave
  U->>L: Ricerca > AGGIORNA INDICE
  U->>L: modello + domanda (max 2000) > ANTEPRIMA FONTI
  L-->>U: elenco fonti (valido 300 s)
  U->>L: controlla fonti > INVIA A OPENAI LE FONTI MOSTRATE
  L->>K: legge chiave
  L->>AI: domanda + fonti mostrate (HTTPS, timeout 30 s)
  AI-->>L: risposta
  L-->>U: risposta + citazioni
  opt conservare
    U->>L: SALVA RISPOSTA COME BOZZA
    L->>L: scrive in 80_AI_OUTPUTS
  end
```

## W6 — Da risposta AI a nota approvata

```mermaid
flowchart LR
  A[Risposte AI > AGGIORNA] --> B[Apri risposta]
  B --> C[Categoria > CREA PROPOSTA DALLA RISPOSTA SALVATA]
  C --> D[Proposte: revisione]
  D --> E[APPROVA REVISIONE MOSTRATA]
  E --> F[Aggiorna Conoscenza e indice]
```

## W7 — Copie locali e integrità

```mermaid
flowchart TD
  A[Copie locali] --> B[Nota facoltativa > CREA COPIA LOCALE]
  B --> C[Copia, manifesto e verifica in staging]
  C -->|riuscita| D[Pubblicata in 00_SYSTEM/SNAPSHOTS/snap-...]
  C -->|errore| E[Staging pulito, nessuna copia pubblicata]
  D --> F[VERIFICA INTEGRITÀ]
  F --> G{Esito}
  G -- Verificata SHA-256 --> OK[Copia valida]
  G -- Incompleta --> X1[Manifesto assente: non usarla come copia valida]
  G -- Danneggiata --> X2[File alterati: non usarla come copia valida]
```

## W8 — Collegare il cloud

```mermaid
flowchart TD
  A[Ricevi codice dall'amministratore] --> B[Trasferimenti > Impostazioni Copia cloud]
  B --> C[Incolla codice > Collega archivio]
  C --> D{Esito}
  D -- Collegamento verificato --> E[Test Connessione quando serve]
  D -- errore --> F[Controlla il codice con l'amministratore. Non inventarlo]
```

## W9 — Pubblicare nel CRM

```mermaid
sequenceDiagram
  actor U as Utente
  participant L as LIMEN
  participant W as Servizio sync (Worker)
  participant R2 as Cloudflare R2
  participant CRM as CRM pii-crm
  U->>L: Pubblica conoscenza
  L-->>U: anteprima note approvate 01-10
  U->>L: seleziona note (anche quelle già pubblicate da mantenere)
  U->>L: Conferma ed Esegui
  L->>W: carica oggetti per hash
  W->>R2: scrittura esclusiva
  L->>W: commit versione
  W-->>L: COMMITTED
  CRM->>W: lettura autorizzata (staff + allowlist)
  W-->>CRM: note della versione corrente
```

Mapping Cliente/Progetto: i campi `client` e `project` della nota devono contenere gli **identificativi CRM esatti**. Il nome visibile non viene convertito. Falli confermare all'amministratore.

## W10 — Copia privata e recupero

```mermaid
flowchart TD
  subgraph Backup
    A[Carica versione] --> B[Controlla elenco ed esclusi] --> C[Conferma ed Esegui]
  end
  subgraph Recupero
    D[Versioni precedenti da recuperare > Carica versioni] --> E[Scegli versione o Ultima versione]
    E --> F[Scarica copia > anteprima > conferma]
    F --> G[Download in staging + verifica hash]
    G --> H[Nuova cartella LIMEN-copy-id accanto al Vault]
    H --> I[Riavvia app > APRI VAULT ESISTENTE sul nuovo percorso]
  end
```

## W11 — Interruzioni e conflitti

```mermaid
flowchart TD
  A[Trasferimento in corso] --> B{Evento}
  B -- Annulla trasferimento --> C[Arresto dopo la richiesta in corso]
  B -- App chiusa / rete persa --> D[Riapri Trasferimenti]
  D --> E[Riprendi trasferimento interrotto: stessa versione]
  B -- Conflitto --> F[Ricarica anteprima, controlla nuovo piano, conferma]
  B -- Download interrotto --> G[Staging .limen-download conservata: non aprirla come Vault]
```

## W12 — Ritirare una pubblicazione

```mermaid
flowchart LR
  A[Ritira pubblicazione] --> B{Conferma?}
  B -- Conferma ritiro --> C[Letture CRM successive negate. Note locali intatte]
  B -- Mantieni pubblicazione --> D[Nessuna modifica]
```
Il ritiro non cancella copie già scaricate da altri. **Disconnetti** è un'altra cosa: toglie solo il collegamento da questo Mac.

## W13 — Codex / client MCP

```mermaid
flowchart TD
  A{Tipo di client} -- client HTTP locale --> B[Impostazioni > ATTIVA MCP LOCALE]
  B --> C[Copia indirizzo, ID Vault, token]
  C --> D[Configura il client]
  D --> E[Uso: list_vaults, search_vault, read_document]
  E --> F[REVOCA MCP a fine lavoro]
  A -- Codex stdio --> G["command: binario limen-vault dentro l'app
args: --mcp-stdio, percorso assoluto Vault"]
  G --> H[Il client avvia il processo]
  H --> I[Per disattivare: togli la configurazione dal client]
```

Il binario accetta esattamente due argomenti: `--mcp-stdio` e il percorso del Vault (`main.rs`).
Il percorso del binario dentro l'app va verificato sul Mac (vedi [[06_NOTE_AUDIT_DOCUMENTAZIONE]]).

## W14 — ChatGPT Business

```mermaid
sequenceDiagram
  actor U as Utente
  participant L as LIMEN
  participant T as Tunnel
  participant G as ChatGPT Business
  U->>L: ID tunnel, ID organizzazione, chiave > SALVA CHIAVE TUNNEL
  U->>L: AVVIA TUNNEL BUSINESS
  L->>T: avvio
  T-->>L: Tunnel locale pronto
  U->>G: verifica dal client ChatGPT
  G->>T: letture di note approvate e automatiche correnti indicizzate
  U->>L: ARRESTA TUNNEL BUSINESS
  U->>G: scollega il plugin (revoca remota)
```

## W15 — Aggiornare l'app

```mermaid
flowchart LR
  A[ARRESTA TUNNEL, chiudi LIMEN] --> B[Installa nuova versione dal DMG]
  B --> C[Copia LIMEN Vault v3 in Applicazioni conservando la versione precedente]
  C --> D[Avvia, APRI VAULT ESISTENTE, verifica Pronto]
```
Il Vault resta fuori dall'app. Rimuovere l'app non cancella il Vault né le chiavi nel Portachiavi.

## W16 — Flusso quotidiano automatico

```mermaid
flowchart LR
  U[Carica originali] --> R[RAW: originale integro]
  R --> E[Estrazione e OCR locali]
  E --> C[Classificazione AI]
  C --> N[Note Markdown nelle categorie]
  N --> W[Wiki con fonti e collegamenti]
  W --> I[Indice e ricerca AI]
```

Una configurazione iniziale autorizza le chiamate automatiche; LIMEN deve restare aperta. Dettagli: [[07_AUTOMAZIONE_DOCUMENTI]].
