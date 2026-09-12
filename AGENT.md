# GENERAL CODER RULES — LIMEN VAULT

Status: regole operative obbligatorie del progetto.
Ambito: sviluppo, debug, audit, test, repository e distribuzione.

## 1. AUTONOMIA E VELOCITÀ

Procedi autonomamente nelle attività autorizzate, pertinenti e reversibili, fino al completamento dell’incarico.
- Una richiesta di implementazione autorizza le modifiche tecniche necessarie, i test pertinenti e la risoluzione dei difetti nel perimetro richiesto.
- Non chiedere conferme già ottenute. Le autorizzazioni restano valide nel relativo incarico.
- Risolvi i dubbi tecnici leggendo codice, schemi, documentazione e risultati dei test.
- Chiedi solo se manca un’informazione indispensabile, serve una decisione di prodotto non deducibile o l’azione richiede un’autorizzazione esplicita secondo queste regole.
- Durante un’attesa, continua le attività indipendenti.
- Quando l’utente chiede STOP, interrompi e non riprendere senza nuova richiesta.

## 2. VERITÀ E INCERTEZZA

Non inventare fatti, accessi, risultati, funzionalità o stati di avanzamento.
- Distingui ciò che esiste da ciò che proponi di creare.
- Le normali scelte implementative sono consentite entro il perimetro autorizzato; motivale quando incidono su comportamento, compatibilità o manutenzione.
- Verifica le informazioni esterne soggette a cambiamento quando servono alla decisione.
- Prima di dare istruzioni passo passo per siti o servizi, verifica l’interfaccia corrente e, se pertinente, l’account. Se non accessibile, dichiaralo senza inventare percorsi.
- Dichiara i limiti delle verifiche. Non presentare una compilazione riuscita come prova di un flusso utente funzionante.

## 3. PERIMETRO E INDIPENDENZA

LIMEN Vault è un sistema locale indipendente. L’accesso ai Vault locali deve funzionare anche quando MEMAI, M3MAI, PII_CRM, Render, Vercel o R2 sono indisponibili.
- Non introdurre dipendenze obbligatorie da questi sistemi per le funzioni locali.
- Le integrazioni esterne esplicitamente richieste devono restare opzionali rispetto all’accesso locale.
- Provider AI di prodotto autorizzati: OpenAI/ChatGPT/Codex e future astrazioni per modelli locali.
- Non integrare Anthropic/Claude, Gemini o DeepSeek, né relativi SDK o credenziali nel prodotto.
- Modifica solo file pertinenti all’incarico. Sono consentite letture tecniche di SDK, toolchain e documentazione, oltre a fixture e directory temporanee isolate necessarie ai test.
- Non modificare dati reali, altri progetti o sistemi esterni senza autorizzazione.
- Non implementare milestone future, redesign o refactoring estranei alla richiesta.
- Una richiesta di audit o piano non autorizza l’implementazione; una richiesta di modifica sì.

## 4. PROTEZIONE DEL LAVORO E DEI DATI

- Conserva le modifiche preesistenti; non eseguire reset o ripristini globali.
- Usa scritture sicure e non sovrascrivere contenuti dell’utente senza autorizzazione.
- Per test distruttivi usa esclusivamente fixture isolate create per il test.
- Non esporre segreti nei messaggi, log o commit. Nei file di esempio usa placeholder.
- Non rimuovere controlli di autenticazione o validazione per aggirare un errore.

## 5. UI E DESIGN

Preserva palette, layout, temi, icone e identità visiva approvati.
- Sono autorizzati collegamenti funzionali, stati di caricamento, messaggi di errore e correzioni tecniche necessarie all’incarico, coerenti con il design esistente.
- CSS, classi o struttura dei componenti possono essere modificati quando necessario alla correzione, preservando il risultato visivo approvato e verificando gli effetti.
- Chiedi prima di un redesign o di un cambiamento visivo sostanziale non richiesto.

## 6. TEST PROPORZIONATI E INTEGRITÀ

- Durante lo sviluppo esegui i test e i controlli pertinenti alle modifiche.
- Non ripetere controlli già riusciti senza nuove modifiche, fallimenti o dubbi concreti che li giustifichino.
- Non creare test che ripetano soltanto l’implementazione o per semplici modifiche documentali.
- Non indebolire asserzioni, rimuovere verifiche o usare skip/xfail per nascondere difetti.
- Puoi correggere un test errato quando dimostri il comportamento atteso da requisiti o evidenze; documenta il motivo.
- Se un test era già rosso, registra fallimento e causa nota. Correggilo se rientra nell’incarico; altrimenti continua il lavoro indipendente e segnala il residuo.
- Non dichiarare completata una milestone con criteri di accettazione aperti.

Prima di un push autorizzato o della chiusura di una milestone applicativa, verifica il checkout finale con:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Esegui questi comandi in sequenza. Per modifiche native aggiungi i test Rust e la build Tauri pertinenti; per flussi utente modificati prova il funzionamento reale. Se cambia ancora il codice, ripeti i controlli interessati. La documentazione aggiornata dopo le verifiche non richiede una nuova build.

Riporta gli esiti effettivi, distinguendo test, build e prove manuali. Un fallimento obbligatorio impedisce il push o la chiusura finché non è risolto.

## 7. ERRORI E TENTATIVI

Al terzo tentativo fallito della stessa azione, interrompi quell’azione. Non azzerare il conteggio cambiando superficialmente comando o strumento.
- Fermati prima se manca chiaramente un prerequisito o un accesso.
- Passa a un’alternativa sostanziale sostenuta da nuove evidenze o alle attività indipendenti.
- Se non puoi progredire, comunica il blocco concreto e il solo accesso o dato necessario.

## 8. GIT E PUBBLICAZIONE

- Ispezioni Git e branch/worktree locali necessari al lavoro sono consentiti; preserva il lavoro preesistente.
- Commit, push, tag di release, merge nei rami principali e deploy richiedono una richiesta esplicita dell’utente.
- Non chiedere di nuovo se l’azione è già autorizzata nel relativo incarico.
- Prima di commit o pubblicazione, rendi disponibili modifiche, verifiche e rischi materiali; aggiorna la checklist.
- Force push, cancellazioni remote e riscrittura della storia richiedono autorizzazione specifica.
- Distingui sempre completato in locale, registrato in Git e pubblicato.

## 9. DATABASE E PRODUZIONE

- Letture pertinenti e preparazione di bozze locali di migrazione sono consentite nell’incarico autorizzato.
- Modifiche a dati, schema, RLS o configurazioni di un database reale richiedono autorizzazione esplicita riferita a destinazione e operazione.
- Prima dell’esecuzione presenta cambiamento concreto, motivo, rischio, SQL/migrazione, possibilità di perdita dati e rollback applicabile.
- Operazioni distruttive in produzione richiedono approvazione specifica; una generica richiesta di implementazione non basta.
- Non introdurre database o migrazioni se non servono alla richiesta.

## 10. DOCUMENTAZIONE: UNA FONTE PER OGNI SCOPO

Mantieni i documenti proporzionati al lavoro, evitando copie dello stesso resoconto.

- `TASK_LIST.md`: checklist principale e stato corrente. Aggiorna titolo, checkbox, verifiche e residui a ogni cambiamento significativo; distinguendo locale, pubblicato, in corso e bloccato.
- `TODO LIST.TXT`: solo blocchi, dipendenze e azioni necessarie per sbloccarli. La roadmap resta nella checklist principale.
- `IMPL_PLANS/IMP_PLAN_<FASE_O_FEATURE>.MD`: un piano breve per attività complesse o quando richiesto. Includi obiettivo, interventi, test e decisioni aperte; impatti e rollback solo quando pertinenti. Collega la task list visibile all’utente.
- `IMPLEMENTATION/`: rapporti tecnici ed evidenze utili, non una seconda copia del piano.
- `SESSION HANDOVER.MD`: contesto corrente sufficiente a riprendere il lavoro; aggiornalo al termine di una sessione con modifiche sostanziali, un piano nuovo, un blocco o una pubblicazione.
- `LAST SESSION/`: storico sintetico delle sessioni significative; rimanda ai documenti correnti senza duplicarli integralmente.
- `TODO/`: eventuali approfondimenti collegati alla checklist, senza mantenere una seconda fonte dello stato.

Crea cartelle e documenti quando servono. Piccoli chiarimenti o audit senza cambiamenti operativi non richiedono una nuova serie di file. Non aggiornare la documentazione a ogni singolo comando.

## 11. COMUNICAZIONE E CONSEGNA

- Comunica in modo breve: risultato, modifiche rilevanti, verifiche effettive e residui.
- Durante lavori lunghi fornisci aggiornamenti utili senza ripetere lo stesso stato.
- Elenca file o rischi solo quando aiutano a capire o riprendere il lavoro.
- Fornisci un walkthrough manuale quando esiste un flusso utente pertinente: cosa aprire, azione, input e risultato atteso. Non imporlo ad audit documentali o attività senza interfaccia.
- Non dichiarare lavoro completato per il solo fatto che il codice è presente.
- Non trasformare il resoconto finale in una nuova richiesta di conferma per attività già autorizzate.
