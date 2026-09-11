# GENERAL CODER RULES — LIMEN VAULT

**Status:** Mandatory project rules  
**Scope:** All coding, debugging, auditing, testing, database, deployment and repository operations  
**Priority:** Critical — these rules override convenience, speed or assumptions

---

# 0. CRITICAL — STRICT PROJECT BOUNDARIES & SYSTEM INDEPENDENCE

LIMEN Vault is an independent local-first knowledge system for LIMEN / Packaging in Italy.

PII_CRM, MEMAI, and M3MAI are external systems.

Do not create runtime dependencies on any external system.

The application must remain fully functional to access an existing local Vault when:
- MEMAI is down
- PII_CRM is down
- Render is down
- Vercel is down
- R2 is down

**Prohibited AI Providers:**
- Anthropic and Claude are explicitly prohibited.
- Gemini and DeepSeek are prohibited.
- Do not add Anthropic SDKs or Anthropic environment variables.

Authorized AI ecosystem:
- OpenAI, ChatGPT, Codex, and future local LLM abstractions.

Perform modifications strictly within the current workspace repository (`LIMEN-VAULT`). Do not access, modify, or create dependencies on external folders or systems unless explicitly authorized by Cesare.

---

# 1. CRITICAL — NO GUESSING

The coder must never guess.

Do not invent:
- database fields
- table names
- API routes
- environment variables
- file paths
- UI components
- business logic
- provider capabilities
- library behavior
- deployment steps
- SQL changes
- migration logic

Use only:
- validated project files
- existing code
- existing schema
- explicit user instructions
- verified documentation
- actual test results
- visible logs
- reproducible operations

If something is unclear, stop and ask before acting.

Use this wording when needed:
```text
I cannot verify this from the current files.
I need confirmation before modifying this part.
This is an assumption and should not be implemented without approval.
```

---

# 2. STRICT GIT RULE

Do not push to Git without specific user instruction.

Forbidden unless explicitly requested:
```text
git push
git push --force
git push --force-with-lease
git tag
git release
merge to main
merge to production
deploy from Git
```

Allowed only when useful and safe:
```text
git status
git diff
git log
git branch
```

Before any commit, show:
```text
files changed
summary of changes
risk level
tests performed
```

Do not commit unless the user asks for it.

---

# 3. STRICT SQL / DATABASE RULE

Do not modify SQL, database schema, migrations, RLS policies, indexes or seed data without informing the user first.

Before any DB/SQL action, provide:
```text
1. Exact file or database object to be changed
2. Reason for change
3. Risk level
4. Rollback plan
5. Whether data loss is possible
6. Exact SQL or migration preview
```

Proceed only after user approval.

---

# 4. REQUIRED PROJECT FOLDERS

The coder must maintain these root folders:
```text
root/IMPLEMENTATION
root/LAST SESSION
root/TODO
```

If they do not exist, maintain them cleanly.

---

# 5. IMPLEMENTATION PLANS

For non-trivial multi-step tasks, document the implementation plan in:
```text
root/IMPLEMENTATION
```

Use clear file names:
```text
IMPLEMENTATION/YYYY-MM-DD_FEATURE_NAME_PLAN.md
```

Each implementation plan must include:
```text
objective
files to modify
files not to modify
database impact
API impact
UI impact
test plan
rollback plan
open questions
```

Do not leave implementation plans only in chat.

---

# 6. LAST SESSION LOG

At the end of work sessions, save a session summary into:
```text
root/LAST SESSION
```

Use clear file names:
```text
LAST SESSION/YYYY-MM-DD_SESSION_SUMMARY.md
```

Each session summary must include:
```text
what was requested
what was changed
files changed
files created
tests run
tests passed
tests failed
known issues
next recommended step
warnings
```

If nothing was changed, state:
```text
No code changes were made in this session.
```

---

# 7. TODO MANAGEMENT

All pending tasks, unresolved issues and future actions must be saved into:
```text
root/TODO
```

Use clear file names:
```text
TODO/YYYY-MM-DD_TODO.md
```

Each TODO file must include:
```text
priority
task description
related files
dependency
risk
status
owner if known
```

Do not hide unresolved tasks inside comments only.

---

# 8. STRICTLY FOLLOW PROMPTS

The coder must follow the user prompt exactly.

Do not:
- add extra features
- redesign the architecture
- change UX without request
- refactor unrelated files
- rename files without reason
- modify database without approval
- change business logic without approval
- implement future-phase features early
- replace specified technology unless approved

If the prompt asks for audit, perform audit only.
If the prompt asks for a fix, fix only the requested issue.
If the prompt asks for a plan, do not implement.
If the prompt asks for implementation, implement only the approved scope.

---

# 9. VALIDATE OPERATIONS

Every operation must be validated.

For code changes, validate with:
```text
type check
lint if available
unit tests if available
build if available
manual runtime check if applicable
```

For backend changes, validate with:
```text
server starts
endpoint responds
expected status codes
error handling
logs reviewed
```

For frontend changes, validate with:
```text
page loads
component renders
no console errors
responsive behavior if relevant
manual flow check
```

Never claim something works unless it was actually tested or clearly mark it as untested.

Use:
```text
Validated:
Not validated:
Could not validate because:
```

---

# 10. AUDIT AND TEST REQUESTS

When the user asks for:
```text
audit
test
QA
check
review
validation
```
the coder must include a manual walkthrough for human testing written so a non-coder can follow it.

Include:
```text
1. What to open
2. Where to click
3. What input to enter
4. What result should appear
5. What error would indicate failure
6. What screenshot/log to capture if it fails
```

---

# 11. REPORTING FORMAT AFTER WORK

After every coding task, report:
```text
Summary
Files changed
Files created
Database impact
Git status
Validation performed
Manual testing walkthrough
Known risks
Next step
```

---

# 12. SAFETY RULE FOR PRODUCTION

Never run destructive operations on production without explicit written approval.

Forbidden without approval:
```text
drop table
truncate
delete without where
reset database
overwrite production env
deploy to production
remove auth checks
disable validation
force push
```

---

# 13. ENVIRONMENT AND SECRETS

Never expose secrets.

Do not print or commit:
```text
API keys
database passwords
JWT secrets
OAuth secrets
service role keys
private tokens
production connection strings
```

Use `.env.example` with placeholders only.

---

# 14. CRITICAL — UI / UX / COLORS / PALETTE CHANGE RULE

QUESTA È UNA REGOLA CRITICA (CRITICAL FLAG):
Le direttive dell'utente su colori, palette, layout e design della UI non devono MAI essere toccate, sovrascritte o re-inventate.

- Se ti viene chiesto di aggiungere funzionalità a un'interfaccia esistente, DEVI preservare esattamente il CSS, le classi, i temi e le icone originali.
- Non cambiare MAI la UI o lo styling senza esplicita richiesta.

Se la UI dovesse essere modificata per risolvere un bug che impedisce il funzionamento, devi prima fermarti e spiegare:
```text
perché il cambio UI è necessario
quale componente deve cambiare
quale impatto visivo avrà
```

Evita ASSOLUTAMENTE modifiche non controllate di layout e colori.

---

# 15. FINAL RULE

When in doubt:
```text
stop
document the uncertainty
ask for confirmation
do not guess
do not push
do not change DB
```

---

# 16. CRITICAL — TEST INTEGRITY

Un test che fallisce è un'informazione, non un ostacolo. Indebolirlo distrugge l'unica cosa che quel test valeva.

## Vietato, sempre
- sostituire un'asserzione con una più debole (`assert x is not None` al posto di un confronto di uguagelza, `assert True`, `assert response.status_code` senza valore atteso)
- rimuovere asserzioni per far passare un test
- aggiungere `skip`, `xfail`, `try/except` che nascondono un fallimento
- cambiare il valore atteso per farlo coincidere con quello prodotto dal codice, senza aver prima dimostrato che il codice ha ragione e il test torto

## Se un test è già rosso prima del tuo intervento
Fermati e segnalalo. Nel resoconto scrivi: nome del test, asserzione che fallisce, valore atteso e valore ottenuto, e perché ritieni che sia rotto. Non toccarlo senza istruzione esplicita.

## Dichiarare i test eseguiti
Non riportare mai un test come eseguito se non lo hai eseguito davvero.

---

# 17. CRITICAL — BUILD VERIFICATION BEFORE PUSH

Prima di ogni push o completamento milestone, esegui la verifica reale del monorepo LIMEN Vault:

```bash
pnpm test          # esegue unit e guard test
pnpm typecheck     # controllo dei tipi TypeScript su app e package
pnpm build         # build di produzione di web, desktop e packages
```

## Vietato
Pushare o dichiarare completato il lavoro quando il controllo dei tipi o il build falliscono.

## Nel resoconto
Incolla l'esito reale dei comandi eseguiti, non la tua aspettativa.

# 17. CRITICAL — AFTER ANY POUSH OR IMPLEMENTATION PLAN
aggirona con cio che e' stato fatto il file in root SESSION HANDOVER.MD , se non esiste crealo, e dai istruzioni come se dovessimo aprire una nuova chat: con i context e altre infor necessarie al coder per iniziare il lavoro con tutte le infor necessarie
