# Audit storage CRM / MEMAI / LIMEN — 13 settembre 2026

## Esito verificato
La voce CRM «Esplora Cloudflare R2 Storage» non elenca un bucket: legge la tabella Supabase `materials`, mostra metadati e apre il relativo `storage_path`. Non è verificato che tutti i documenti MEMAI siano registrati in questa tabella. La dicitura «bucket R2 da 3TB» è testo statico, non una misura di capacità o consumo. Il pulsante Elimina nel componente non ha handler.

| Funzione | Destinazione / evidenza |
| --- | --- |
| Catalogo materiali CRM | Supabase materials; link storage_path di ogni record |
| Report PDF CRM | R2_BUCKET_REPORTS prioritario; valore produzione esportato: m3mai-core-vault |
| Upload generico CRM (anche type m3mai) | CLOUDFLARE_R2_BUCKET_NAME; stesso valore letto dal bridge produzione: pii-limen |
| Immagini testimonials, case-histories, blog, newsletter | R2_MEDIA_BUCKET; valore produzione oscurato nell’export, nome non certificato in questo audit |
| Backup CRM | R2_BACKUPS_BUCKET oppure default m3mai-backups; override produzione non certificato |
| MEMAI | render.yaml configura STORAGE_TYPE=s3, AWS_S3_BUCKET=m3mai-core-vault ed endpoint Cloudflare; override attuali Render non verificati in questo audit |
| Worker LIMEN pubblicato | Binding VAULT=m3mai-core-vault, namespace limen/; verifiche R2 già registrate |
| Bridge LIMEN nel CRM | Precedenza globale CLOUDFLARE_R2_BUCKET_NAME su R2_BUCKET_REPORTS; produzione restituisce bucket pii-limen e UNAVAILABLE, autorizzazione Vault non configurata |

## File ispezionati
CRM: app/admin/materials/page.tsx, MaterialsExplorer.tsx, lib/r2.ts, lib/limen-bridge.ts, app/api/upload/presigned/route.ts, app/api/admin/r2/list/route.ts, app/api/admin/r2/upload/route.ts, app/api/admin/backups/download/route.ts.
MEMAI: render.yaml, apps/backend-fastapi/app/utils/storage.py, app/config.py.

## Correzione implementata e pubblicata
- Bridge usa LIMEN_R2_BUCKET_NAME=m3mai-core-vault, indipendente dagli upload CRM.
- Allowlist Admin/Superadmin verificata dopo guard staff; negati account non autorizzati.
- Catalogo con selettori Materiali CRM / MEMAI e LIMEN Vault; rimossa capacità fissa 3TB. Nessun record o file duplicato.
- Test 7/7, typecheck/build PASS. Produzione: NO_PUBLICATION sul bucket corretto, anonimo 403, catalogo Safari PASS. Evidenza M10_EVIDENCE/crm-storage-production.json.

## Indicazioni emerse nell’audit iniziale (routing e allowlist ora corretti)
- Collegare il bridge LIMEN al bucket condiviso concordato senza cambiare la variabile globale usata dagli upload CRM.
- Verificare allowlist e lettura autenticata nella produzione pii-crm.vercel.app.
- Rendere chiaro in UI che Storage è un catalogo; non rappresentare capacità 3TB come rilevata.
- Verificare registrazione e permessi dei documenti MEMAI nel catalogo: stesso bucket non implica stesso indice o accesso automatico.

Nessun oggetto spostato, cancellato o migrato durante l’indagine. Nessun nuovo bucket creato.
