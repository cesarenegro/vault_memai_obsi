---
title: "LIMEN Vault — Problemi comuni e glossario"
type: help
tags: [limen-vault, troubleshooting, glossario]
---

# Problemi comuni e glossario

Torna all'indice: [[00_INDICE]]

## Messaggi dell'app e cosa fare

Messaggi tradotti presenti in `apps/desktop/src/locale.tsx`:

| Messaggio | Causa | Cosa fare |
| --- | --- | --- |
| Configura la chiave API nelle Impostazioni. | Nessuna chiave salvata | Impostazioni → SALVA CHIAVE |
| Indica un modello API disponibile nel tuo account. | Campo modello vuoto | Scrivi l'identificativo del modello |
| Il formato della chiave API non è valido. | Chiave incollata male | Ricopia la chiave completa |
| Accesso al Portachiavi negato o non disponibile. | macOS ha negato l'accesso | Riprova e autorizza nella finestra macOS |
| Impossibile rimuovere la chiave dal Portachiavi. | Rimozione non riuscita | Controlla in Accesso Portachiavi |
| ID del tunnel o dell'organizzazione non valido. | Dati Business errati | Ricontrolla i due ID |
| Salva la chiave del tunnel nelle Impostazioni. | Chiave tunnel mancante | SALVA CHIAVE TUNNEL |
| Accesso alla chiave del tunnel nel Portachiavi negato. | Permesso negato | Autorizza nella finestra macOS |
| Il Vault non ha superato la validazione. | Struttura o frontmatter non validi | Leggi gli errori elencati |
| Il percorso del Vault non indica una cartella. | Percorso di un file | Indica la cartella |
| Anteprima scaduta. Seleziona nuovamente le fonti. | Più di 300 s dall'anteprima | ANTEPRIMA FONTI di nuovo |
| Anteprima scaduta o nessuna fonte utilizzabile… | Scadenza o nessuna nota idonea | Aggiorna indice, controlla note approvate |
| È già in corso una richiesta AI. | Doppio invio | Attendi o ANNULLA |
| Una fonte è cambiata dopo l'anteprima… | Nota modificata nel frattempo | Nuova anteprima |
| Richiesta annullata. | Hai premuto ANNULLA | — |
| Accesso al documento negato. | Percorso fuori dai limiti consentiti | Apri il documento dal suo elenco |
| La nota è cambiata durante la lettura… | Modifica simultanea in Obsidian | Aggiorna la schermata |
| L'anteprima della categoria supera il limite di 8 MiB. | Categoria troppo grande | Consulta tramite Ricerca o Obsidian |
| Operazione non completata. Consulta il dettaglio tecnico… | Errore non tradotto (sistema/fornitore) | Conserva il *Dettaglio tecnico originale* per l'assistenza |

## Situazioni tipiche

| Sintomo | Verifica | Soluzione |
| --- | --- | --- |
| Il Vault non si apre | Percorso assoluto? Cartella LIMEN con 15 cartelle e 3 file di sistema? | Correggi; una cartella Obsidian generica non basta. Non cancellare file per forzare |
| CREA NUOVO VAULT rifiuta | La cartella esiste e non è vuota | Scegli un percorso nuovo |
| Nessuna nota in Conoscenza | File nella cartella giusta? Estensione `.md`? | AGGIORNA CONOSCENZA |
| Ricerca vuota | Indice aggiornato? Filtri? Campo `client`/`project` nella nota? | Togli filtri, AGGIORNA INDICE DI RICERCA |
| Invio a OpenAI disabilitato | Anteprima senza fonti | Approva/indica note, aggiorna indice, nuova anteprima |
| OpenAI non risponde | Rete, chiave, modello, credito | Leggi il dettaglio; il lavoro locale continua |
| Fonte *Non supportata* | Formato PDF/Word ecc. | Converti in `.md`, `.txt` o `.html` |
| APPROVA respinta | Destinazione fuori categoria, già esistente, non `.md`, in RAW, o revisione cambiata | Correggi percorso; riapri la proposta |
| *Differenze rilevate* in Panoramica | Elenco file modificati/mancanti/aggiunti | Se le modifiche sono tue è normale |
| Copia *Danneggiata* / *Incompleta* | — | Non usarla come copia valida; creane una nuova |
| Cambio Vault | — | Riavvia l'app e usa APRI VAULT ESISTENTE. Non modificare il campo in Impostazioni |
| Cloud *Non configurato* | Codice mai inserito | Chiedi il codice all'amministratore |
| *Conflitto* nei trasferimenti | Esiste una versione remota più recente | Ricarica l'anteprima e riconferma. Non forzare |
| Trasferimento interrotto | — | Riprendi trasferimento interrotto |
| CRM mostra `NO_PUBLICATION` | Nessuna pubblicazione completata | Approva note reali e Pubblica conoscenza |
| MCP non risponde dopo riavvio | L'MCP si spegne al riavvio | ATTIVA MCP LOCALE di nuovo e aggiorna il token nel client |
| Obsidian non si apre | Sistema → Applicazione Obsidian | Installa Obsidian o registra la cartella (W2) |

## Cose da non fare

- Non scrivere a mano in `00_SYSTEM`, `80_AI_OUTPUTS`, `90_PROPOSALS`.
- Non spostare file nelle cartelle `01`–`10` per aggirare l'approvazione.
- Non tradurre nomi di cartelle o proprietà.
- Non cancellare file di stato, journal o cartelle `.pending-*` / `.limen-download-*` per "far sparire" un errore.
- Non aprire una staging di download parziale come Vault.
- Non condividere token MCP, chiavi o codici di collegamento in chat o nelle note.
- Non aggirare Gatekeeper né rimuovere la quarantena durante l'installazione.

## Glossario

| Termine | Significato |
| --- | --- |
| Vault | Cartella del Mac con la struttura LIMEN, compatibile con Obsidian |
| Frontmatter | Blocco proprietà YAML in testa alla nota, tra due righe `---` |
| Fonte originale (RAW) | File in `20_RAW_SOURCES`, mai modificato e mai inviato all'AI |
| Compilazione | Estrazione locale del testo da una fonte per creare una bozza |
| Bozza | Nota con `status: draft` in `90_PROPOSALS` |
| Proposta | Candidato alla conoscenza approvata, con revisioni conservate |
| Revisione | Versione di una proposta; ogni modifica ne crea una nuova |
| Approvazione | Scrittura della revisione in `01`–`10` con `status: approved` |
| Indice di ricerca | Archivio locale per la ricerca; va aggiornato a mano |
| Manifesto | Elenco dei file con impronta SHA-256 |
| SHA-256 | Impronta crittografica che rivela qualsiasi modifica al file |
| Copia locale (snapshot) | Copia verificata in `00_SYSTEM/SNAPSHOTS` |
| Pubblicazione | Versione di note approvate leggibile dal CRM |
| Copia privata | Versione completa nel cloud, non leggibile dal CRM |
| Portachiavi | Archivio sicuro di macOS per chiavi e token |
| MCP | Protocollo con cui un client esterno (es. Codex) consulta il Vault in sola lettura |
| Tunnel Business | Collegamento privato tra il Mac e ChatGPT Business |
| R2 | Archivio cloud Cloudflare; bucket `m3mai-core-vault`, prefisso `limen/` |
