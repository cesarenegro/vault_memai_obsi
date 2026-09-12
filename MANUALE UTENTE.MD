# LIMEN Vault — Manuale operativo 0.1.0

Aggiornato il 12 settembre 2026. M2–M8 completate in locale su macOS ARM64. Il candidato M9 è firmato e installato, ma non ancora notarizzato: non è una release pubblicata. Sono operative compilazione locale, ricerca, API OpenAI, consultazione MCP e revisione umana delle proposte. Il collegamento Business del pacchetto installato è ancora in accettazione.

## Creare o aprire un Vault

1. Avviare l’app macOS LIMEN Vault. Nel campo **Target Vault Path (Local Directory)** inserire la cartella desiderata.
2. Usare **CREATE NEW VAULT** per una cartella nuova o vuota; vengono create le 15 cartelle obbligatorie e i tre file di sistema dal template incorporato.
3. Usare **OPEN EXISTING VAULT** per una cartella già creata. L’apertura valida l’albero in sola lettura e mostra stato, percorso e conteggi reali.

La versione browser mostra l’indisponibilità delle operazioni native e non crea file. Il bundle macOS funziona senza Node, server di sviluppo o rete. Per cambiare Vault riavviare l’app e scegliere un percorso nella schermata iniziale; Settings non implementa ancora un selettore persistente.

La creazione rifiuta una destinazione occupata e non sovrascrive file. Il template viene verificato prima delle scritture; directory e file vengono creati in esclusiva. Se si verifica un errore a metà operazione, i dati parziali restano sul disco: scegliere una nuova destinazione oppure esaminare manualmente quella parziale. L’app non cancella automaticamente dati potenzialmente preesistenti o concorrenti e non promette una transazione atomica dell’intero albero.

## Stati e conteggi

| Stato | Significato |
| --- | --- |
| NO_VAULT | Nessun Vault selezionato |
| NOT_ACCESSIBLE | Root inesistente o non accessibile |
| INCOMPLETE | Una cartella obbligatoria manca |
| INVALID | File obbligatori, manifest, frontmatter o accessi interni non validi |
| READY | Validazione strutturale superata |

READY certifica la struttura. La card SHA-256 di M3 mostra VERIFIED dopo il confronto effettivo con il manifest, DISCREPANCY per file modificati/mancanti/aggiunti e UNVERIFIED quando la verifica non è stata completata. Un Vault appena creato mostra 2 file Markdown (HOME e VAULT_RULES), 0 fonti e 0 proposte. I conteggi sono rilevati nella stessa scansione di validazione.

La validazione non modifica contenuti, elenco dei file, mtime o ctime; atime dipende dal filesystem. I link simbolici discendenti sono rifiutati, anche quelli interni, per evitare cicli e reindirizzamenti. La root selezionata viene canonicalizzata, inclusi gli alias macOS /tmp e /var.

## Aprire in Obsidian

LIMEN rileva Obsidian nelle installazioni globale e utente. Il pulsante **Open in Obsidian** apre direttamente un Vault già registrato nell’app ricevente.

Per un nuovo Vault, Obsidian richiede una registrazione iniziale. LIMEN apre il selettore e mostra il percorso da scegliere. Usare **Open folder as vault → Open**, selezionare la cartella appena creata da LIMEN e confermare. Poi premere nuovamente **Open in Obsidian**. Non occorre creare un secondo Vault. Le etichette inglesi e il comportamento sono stati verificati nell’interfaccia Obsidian 1.13.7 l’11 settembre 2026. LIMEN legge il registro locale senza modificarlo; Obsidian può creare la propria cartella `.obsidian` nel Vault selezionato.

## 📂 1. Guida alla Scelta della Sottocartella

L'utente (o il consulente) deposita i file Markdown (`.md`) nella cartella appropriata a seconda del tipo di contenuto:

### 📥 Se stai inserendo materiale di partenza grezzo:
* **`20_RAW_SOURCES/`**: Inserisci qui tutti i documenti di input grezzi, trascrizioni di chiamate, appunti non strutturati, brief iniziali o estratti.
  * *Perché?* Il compilatore legge queste fonti senza modificarle; RAW è escluso dal contesto AI.

### 🏢 Se stai inserendo conoscenza organizzata e strutturata:
* **`01_CLIENTS/`**: Profili e schede dei clienti (es. `cliente-acme.md`).
* **`02_PROJECTS/`**: Schede di progetto e deliverable (es. `progetto-restyling-2026.md`).
* **`03_BRANDS/`**: Brand del cliente o analisi dei marchi (es. `brand-identity-xyz.md`).
* **`04_POSITIONING/`**: Strategie e framework di posizionamento.
* **`05_PACKAGING_KNOWLEDGE/`**: Conoscenza tecnica su materiali, strutture, imballaggi e sostenibilità.
* **`06_METHODS/`**: Metodologie operative e checklist di lavoro.
* **`07_CASE_STUDIES/`**: Casi studio completati e metriche di successo.
* **`08_MARKET_RESEARCH/`**: Ricerche di settore e analisi di mercato.
* **`09_COMPETITORS/`**: Schede e analisi dei concorrenti.

### 📄 Se stai inserendo output definitivi ed approvati:
* **`10_APPROVED_OUTPUTS/`**: Contiene output approvati. Nel workflow M7 usare l’approvazione esplicita: crea un nuovo file e conserva la proposta originale.

---

## Formato delle note

Le note sono file Markdown. Una nota libera senza frontmatter è accettata con un avviso (i file di sistema non richiedono tale avviso). Quando presente, il frontmatter deve essere una mappa YAML valida e rispettare `vault-schema`: id, title, type, created_at e updated_at sono obbligatori; gli altri campi seguono lo schema.

```yaml
---
schema_version: 1
id: cliente-acme-posizionamento
title: "Strategia Posizionamento Packaging ACME"
type: positioning
client: acme-corp
project: restyling-linea-2026
status: approved
created_at: "2026-09-11T00:00:00Z"
updated_at: "2026-09-11T00:00:00Z"
tags: [packaging, posizionamento, acme]
---

# Strategia Posizionamento Packaging ACME

Qui va il testo in formato Markdown della nota...
```

Le date YAML restano stringhe. Intestazioni non chiuse, sintassi invalida, liste/scalari al posto della mappa o campi con tipi errati rendono il Vault INVALID.

## Snapshot locali e integrità — M3

1. Aprire o creare il Vault nell’app desktop. La Home verifica i file rispetto al manifest del Vault attivo.
2. Aprire **Snapshots**, inserire eventualmente una nota e premere **CREATE SNAPSHOT**. La copia viene pubblicata in `00_SYSTEM/SNAPSHOTS/snap-…/` solo dopo copia, manifest e verifica riusciti.
3. L’elenco mostra snapshot, data, nota, numero di file e stato. Chiudendo e riaprendo l’app gli snapshot restano su disco.
4. Premere **RECHECK INTEGRITY** per ricalcolare gli hash degli snapshot e del Vault. VERIFIED indica corrispondenza al manifest; CORRUPTED segnala alterazioni o manifest invalido; INCOMPLETE indica manifest assente.
5. Se la lettura non riesce, l’app mostra l’errore e UNVERIFIED nella Home. Correggere il problema di accesso e riprovare; i pulsanti tornano disponibili dopo l’errore.

I conteggi Home riguardano il Vault attivo, escludendo le copie archiviate. Creare uno snapshot non aggiorna il manifest del Vault attivo: una modifica ai documenti può continuare a essere segnalata come discrepanza. SHA-256 verifica la corrispondenza con il manifest locale, non la sua autenticità.

La pubblicazione dello snapshot è atomica e non sovrascrive quelli esistenti. Non è una cattura istantanea del filesystem: evitare modifiche simultanee se serve una versione uniforme dei documenti. Gli errori gestiti puliscono il proprio staging; un arresto forzato può lasciare `.pending-*`, ignorato dall’elenco e non pubblicato. Non è implementata una funzione di ripristino automatico del Vault.

Per una prova manuale usare un Vault temporaneo: creare uno snapshot, riavviare l’app e verificarne la presenza; modificare un file nella sola copia e premere RECHECK. Il risultato deve essere CORRUPTED mentre il Vault originale resta verificato. In caso di errore conservare messaggio e schermata. Non eseguire questa prova su copie che servono come backup reale.

## Conoscenza, fonti e ricerca

Knowledge legge direttamente i Markdown delle categorie, anche senza indice di ricerca. Sources mostra i documenti RAW; la compilazione locale genera bozze in 90_PROPOSALS, conservando l’originale. Le bozze compilate richiedono revisione prima di diventare conoscenza approvata.

Search utilizza un indice locale. Dopo nuove note o approvazioni usare RE-INDEX SEARCH VAULT. Un indice corrotto viene segnalato e preservato; non viene azzerato silenziosamente. Le etichette Home Markdown Files e Proposal Files contano file e revisioni, non decisioni ancora pendenti.

## OpenAI e salvataggio delle risposte

In Settings inserire la chiave nel campo OpenAI API key e usare SAVE KEY. Il valore resta nel Portachiavi macOS; l’eventuale autorizzazione va completata nella finestra macOS. CHECK KEYCHAIN verifica la presenza, non la validità presso OpenAI. La validità e il modello sono verificati quando parte una richiesta.

In Ask Knowledge scegliere un modello disponibile, scrivere la domanda e usare PREVIEW SOURCES. Esaminare i documenti mostrati prima di SEND DISPLAYED SOURCES TO OPENAI. Per interrompere l’attesa usare CANCEL: una richiesta già trasmessa può comunque essere elaborata dal provider. Senza rete la consultazione locale resta utilizzabile.

SAVE OUTPUT AS DRAFT salva esplicitamente la risposta, il modello e le fonti disponibili. Non promuove il testo a conoscenza approvata. AI Outputs consente di ritrovarlo dopo riavvio e offline.

## Proposte e approvazione umana

In Proposals creare una proposta da un output oppure importare esplicitamente una bozza M4. Controllare contenuto, fonti e hash. Ogni modifica produce una nuova revisione; le precedenti restano conservate. L’importazione mantiene il documento originale anche quando contiene frontmatter nel corpo: rivederlo prima di approvare.

Scegliere la destinazione consentita, esaminare la revisione esatta e confermare l’approvazione. Il backend controlla nuovamente hash e revisione. Una collisione non sovrascrive la nota esistente; RAW non è una destinazione ammessa. Il rifiuto registra la decisione senza cancellare la bozza. Reindicizzare esplicitamente dopo pubblicazione.

In caso di operazione interrotta conservare i file e usare il recupero esplicito del workflow. Non cancellare manualmente stato/journal per nascondere l’errore. Indici corrotti e conflitti richiedono esame; le prove di arresto processo non garantiscono recupero dopo guasti hardware o perdita di alimentazione.

## Client esterni e rilascio M9

MCP espone soltanto consultazione di conoscenza approvata e indicizzata. ENABLE LOCAL MCP attiva l’endpoint locale; REVOKE MCP lo arresta e invalida l’accesso. Non condividere il token in chat o documenti.

Codex può usare il comando stdio del binario installato, con il percorso Vault autorizzato come argomento separato: /Users/cesare/Applications/LIMEN Vault.app/Contents/MacOS/limen-vault --mcp-stdio <percorso-assoluto-vault>. Nei file di configurazione utilizzare un campo command e un array args, preservando gli spazi. Non inserire il percorso del checkout. Il client avvia il processo; rimuovere la sua configurazione e arrestare la sessione per disabilitarlo.

Le impostazioni Business contengono identificativi tunnel/organizzazione, chiave runtime separata nel Portachiavi e comandi START/STOP BUSINESS TUNNEL. La readiness locale non certifica la connessione remota. La procedura di accettazione M9 è ancora aperta: non considerare il candidato una distribuzione Business verificata.

Il Vault deve restare fuori dalla .app. Prima di aggiornare fermare tunnel e applicazione; conservare la precedente copia fino alla verifica della nuova versione. Il banco ha verificato sostituzione e rollback della stessa versione, non migrazioni tra schemi diversi. La rimozione della sola applicazione conserva il Vault; le credenziali nel Portachiavi non vengono automaticamente cancellate.

Installazione DMG notarizzato, Gatekeeper e account macOS pulito restano verifiche M9 aperte. Non aggirare Gatekeeper né rimuovere quarantena per dichiarare riuscita l’installazione.
