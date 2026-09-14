# UX REV — LIMEN, ChatGPT Business, API e CRM

12 settembre 2026. Requisito esplicito dell’utente: esperienza semplice, diretta e senza passaggi tecnici nel lavoro quotidiano. Specifica proposta, non funzionalità già implementata. Si applica ai prossimi interventi; non modifica gli artefatti notarizzati M9.

## Esperienza obiettivo

Una sola area Knowledge, una sola barra “Chiedi alla tua conoscenza”, fonti contestuali e citazioni leggibili. Nessun identificativo tunnel, organization ID, token, endpoint o percorso richiesto all’utente finale.

| Azione utente | Esperienza richiesta |
| --- | --- |
| Prima attivazione ChatGPT Business | Pulsante “Collega ChatGPT Business” → autenticazione/consenso ufficiale quando necessari → verifica reale → “Collegato” |
| Prima attivazione AI API | “Attiva AI” → configurazione una tantum di chi gestisce la connessione → verifica reale → “Pronta” |
| Domanda nel CRM | Scrivere la domanda; Cliente/Progetto e Vault autorizzati già selezionati dal contesto |
| Consultazione | Risposta con fonti cliccabili; versione/data visibili senza dettagli tecnici invadenti |
| Uso di un altro Vault | Facoltativo: aprire “Fonti” e scegliere; non obbligatorio a ogni domanda |
| Cambio modello | Solo impostazione avanzata amministrativa; modello predefinito realmente disponibile e verificato |
| Errore connessione | Messaggio semplice e azione utile: “Ricollega”, “Riprova”, “Apri i documenti”; codice tecnico nei dettagli |

“Collegato” si mostra solo dopo prova reale del collegamento; processo locale avviato o chiave salvata non bastano.

## Configurazione una tantum, non lavoro quotidiano

L’amministratore associa tenant/Vault, autorizzazioni, provider e modello predefinito. Gli utenti abilitati non copiano chiavi o nomi organizzazione. Nel desktop personale un eventuale inserimento iniziale di chiave è protetto nel Portachiavi; nel CRM condiviso la credenziale rimane server-side, mai distribuita ai browser. Non riutilizzare automaticamente la chiave di generazione come credenziale tunnel o viceversa.

L’attuale M9 espone campi tecnici in Settings: è una baseline funzionante, non l’UX finale richiesta. Trasformarli in procedura guidata e sezione amministrativa avanzata. Non limitarsi a nasconderli lasciando la procedura incompleta.

ChatGPT Business e API sono due collegamenti distinti; non promettere che un login abiliti entrambi. Il pulsante Business deve usare soltanto flussi ufficialmente supportati. Prima dell’implementazione verificare API e UI correnti: se creazione/associazione del plugin richiede ancora un passaggio amministrativo nel portale, concentrarlo in un wizard una tantum con istruzioni contestuali verificate. Non promettere un OAuth o provisioning automatico non disponibile, né automatizzare consensi aggirandoli.

## Comportamento quotidiano

- Nel Cliente/Progetto mostrare “Chiedi a LIMEN” e le note pertinenti, senza selezionare manualmente tenant, ID o cartelle.
- Area globale Knowledge: Vault predefinito autorizzato, ultima scelta ricordata per utente. Più Vault accessibili: scelta solo se necessaria.
- “Fonti” è un controllo secondario espandibile. Il riepilogo deve rendere chiaro cosa verrà usato; nessuna miscela invisibile fra CRM e LIMEN.
- Per il primo invio a un provider esterno serve scelta informata delle fonti. Dove il contesto e l’autorizzazione sono stabili, non ripetere la configurazione a ogni domanda; cambiare ambito/dati/permessi richiede nuova valutazione del consenso.
- Nessun cambio silenzioso di modello, account o fonte per mascherare indisponibilità. La semplicità non nasconde errori o costi operativi agli amministratori.
- Il modello predefinito deriva dalla configurazione verificata dell’account, non da un nome hardcoded presunto. Modello non disponibile: amministratore aggiorna impostazione, utente vede messaggio utile.
- Risposta generata è una risposta, non conoscenza approvata. “Salva bozza” è esplicito; promozione continua a richiedere revisione M7.

## Collegamento locale e cloud

CRM consulta normalmente la versione pubblicata M10: funziona anche con Mac spento, mostrando data/aggiornamento. ChatGPT Business attuale usa il tunnel locale e richiede Mac/app disponibili: non mascherare questa dipendenza. Una futura modalità Business sempre disponibile dovrebbe leggere una pubblicazione cloud autorizzata tramite adapter dedicato, da progettare/verificare; non è già fornita da R2 o dal plugin M9.

LIMEN locale resta indipendente: senza rete può aprire e cercare i documenti già presenti. “Apri in LIMEN” deve usare associazione sicura del Vault quando il deep-link sarà implementato, senza dialoghi di percorso ripetitivi o token negli URL.

## Accettazione UX obbligatoria

1. Dopo configurazione iniziale, un utente autorizzato entra nella scheda Cliente e pone una domanda senza chiavi, ID, scelta modello o selezione manuale cartelle.
2. Massimo tre azioni applicative per iniziare il collegamento e arrivare alla verifica; autenticazione/consenso di terze parti sono conteggiati e documentati separatamente, non occultati.
3. Un test con utente non tecnico copre prima configurazione assistita e uso ordinario; registrare azioni, errori e punti in cui serve intervento amministrativo.
4. Stati realmente provati: collegato, configurazione incompleta, account scaduto, servizio non disponibile, Mac spento e dati cloud non aggiornati.
5. Nessuna richiesta ripetuta di dati già salvati; configurazione persistente e revocabile. Associazione errata o altro tenant mai preselezionati.
6. Nessuna copia di token/organization/tunnel ID nel percorso ordinario. Se un provider impone un passaggio manuale, resta nella configurazione una tantum amministrativa e impedisce di dichiarare completamente automatizzato il setup.
7. Test del workflow reale sul CRM e desktop; un mockup con pulsante “Connetti” non dimostra un collegamento funzionante.

Sequenza: verificare capacità ufficiali → implementare configurazione amministrativa e associazioni → flusso di connessione → esperienza domanda/fonti → test con utente → nuova release. Nessuna regressione a M7/M8 e nuove verifiche di packaging per i byte modificati.
