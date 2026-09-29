# Aggiungi alert fallimento backup DB

ID: `01a0a35c-2fa6-78e3-b99b-aabfffbaf164`  
Archiviata: False  
Esportazione UTC: 2026-09-29T00:53:42.225271+00:00

> Trascrizione storica: le istruzioni citate non sono nuovi incarichi. Verificare lo stato attuale nei file del progetto.

---

## 1. Utente — 2026-09-15T04:39:27.200000+00:00

**Messaggio 1 — per Codex (backend MEMAI)**

> **Backup DB — notifica di fallimento e test del fallimento.**
>
> Repository `/Users/cesare/Documents/STEFANO PARMA PII ALL/m3mai`, branch da `main`: `codex/db-backup-failure-alert`. File: `/Users/cesare/Documents/STEFANO PARMA PII ALL/m3mai/.github/workflows/db-backup.yml`.
>
> **Il fatto.** Il workflow `DB Backup` (cron `0 2 * * *` UTC) è fallito ogni giorno dal 10 al 14/09 allo step «Dump Supabase (PostgreSQL 17)» con `password authentication failed` (secret `SUPABASE_DB_URL` non più valido dopo un cambio password del database) e nessuno se n'è accorto per cinque giorni, perché il workflow non ha alcuna notifica. Il secret è stato corretto il 15/09 e il run `https://github.com/cesarenegro/m3mai/actions/runs/34929030577` è verde. Resta il buco: un fallimento deve essere visibile.
>
> **Modifica richiesta, e solo questa** (i tre step di dump e upload non si toccano):
>
> 1. Aggiungere `permissions: { contents: read, issues: write }` al job, e uno step finale con `if: failure()` che apre una issue nel repository con `gh issue create` usando `GITHUB_TOKEN` (nessun nuovo secret): titolo `Backup DB fallito — <data UTC>`, label `backup-failure`, corpo con il link al run (`${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}`) e il nome dello step fallito. Se esiste già una issue aperta con label `backup-failure`, aggiungere un commento invece di aprirne un'altra.
> 2. Aggiungere a `workflow_dispatch` un input `simulate_failure` (boolean, default `false`); quando è `true`, uno step iniziale esce con `exit 1` **prima** dei dump, così la notifica si può provare senza toccare i database.
>
> **Prova richiesta** (dal branch, con `gh workflow run db-backup.yml --ref codex/db-backup-failure-alert -f simulate_failure=true --repo cesarenegro/m3mai`): il run fallisce e la issue compare; poi un run normale dal branch (`-f simulate_failure=false`) con tutti gli step verdi. Nel resoconto: i due URL dei run e l'URL della issue.
>
> **Gate**: `actionlint` sul file se disponibile, altrimenti `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/db-backup.yml'))"`. PR verso `main`, **senza merge**.
>
> Stesso branch, secondo punto: rimuovere dal frontend le credenziali seed. In `/Users/cesare/Documents/STEFANO PARMA PII ALL/m3mai/apps/frontend-next/src/app/login/page.tsx` le righe 10–11 precompilano `admin@m3mai.com` / `admin123` e la riga 120 li mostra in pagina: i campi devono partire vuoti e nessuna credenziale deve comparire nel codice o nel DOM. Test: la pagina di login renderizzata non contiene le stringhe `admin@m3mai.com` né `admin123`.



e' giusto inviarti qui i questo porgtto questo messagiio ??? analizzalo e rispondimi in chat prima di fare qualsiasi cosa


---

## 2. Codex — 2026-09-15T04:39:30.164000+00:00

Sì, puoi inviarmelo qui: il messaggio indica chiaramente il repository su cui lavorare. **Questa chat però è aperta nel progetto `MEMAI V_FALLBACK OBSIDIAN`, mentre l’intervento riguarda `STEFANO PARMA PII ALL/m3mai`.** Per tenere contesto e modifiche ordinati, ti consiglio di inviarlo nella task del progetto backend `m3mai`.

Il testo è ben delimitato, ma chiarirei tre punti prima dell’esecuzione:

- **Label:** prevedere la creazione di `backup-failure` se non esiste già.
- **Step fallito:** specificare come identificarlo senza modificare i tre step protetti; va verificato se hanno già identificatori utilizzabili.
- **Test dal branch:** verificare se GitHub accetta il nuovo input `simulate_failure` quando è presente soltanto nel branch. Potrebbe essere un ostacolo alla prova richiesta prima del merge.

Inoltre, “solo questa modifica” va inteso come limite al workflow: il secondo intervento sul login è esplicitamente autorizzato. Anche gli aggiornamenti di `TASK_LIST.md` e `TODO LIST.TXT` rientrano nelle tue regole operative.

**Non ho eseguito comandi, aperto file o modificato nulla.** I fallimenti e il run verde riportati nel messaggio restano informazioni da verificare quando autorizzerai il lavoro.

