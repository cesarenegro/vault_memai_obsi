import React, { useEffect, useState } from 'react';
import { labelIt, MessageIt } from './locale';
import { m7, operationId, type M7Item } from './proposal-ipc';
import { invoke } from '@tauri-apps/api/core';
import { RotateCw, CheckCircle2, XCircle, Edit3, History, FileText, FolderCheck } from 'lucide-react';

const categories = ['client', 'project', 'brand', 'positioning', 'packaging', 'method', 'case_study', 'research', 'competitor', 'approved_output'];
const dirs = ['01_CLIENTS', '02_PROJECTS', '03_BRANDS', '04_POSITIONING', '05_PACKAGING_KNOWLEDGE', '06_METHODS', '07_CASE_STUDIES', '08_MARKET_RESEARCH', '09_COMPETITORS', '10_APPROVED_OUTPUTS'];

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'nuova-nota';
}

export function ProposalPanel({ vaultPath, kind }: { vaultPath: string; kind: 'output' | 'proposal' }) {
  const [items, setItems] = useState<M7Item[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('client');
  const [drafts, setDrafts] = useState<{ relative_path: string; title: string; markdown: string }[]>([]);

  async function action(q: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const r = await m7(vaultPath, q);
      setItems(r.items);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let live = true;
    setItems([]);
    void m7(vaultPath, { action: 'list' })
      .then((r) => {
        if (live) setItems(r.items);
      })
      .catch((e) => {
        if (live) setError(String(e));
      });

    if (kind === 'proposal') {
      void invoke<typeof drafts>('list_proposals', { vaultPath })
        .then((r) => {
          if (live) setDrafts(r);
        })
        .catch((e) => {
          if (live) setError(String(e));
        });
    }
    return () => {
      live = false;
    };
  }, [vaultPath, kind]);

  const filteredItems = items.filter((i) => i.kind === kind);

  return (
    <div className="limen-card" style={{ padding: 24 }}>
      {/* PANEL HEADER */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px 0', color: '#0f172a' }}>
          {kind === 'output' ? 'Risposte AI salvate' : 'Revisione delle proposte'}
        </h3>
        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: 0 }}>
          Le modifiche restano locali. L’inserimento nella conoscenza richiede l’approvazione della revisione mostrata. Dopo le modifiche aggiorna l’indice di ricerca; le differenze rispetto al manifesto restano visibili.
        </p>
      </div>

      {/* TOOLBAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 16px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            disabled={busy}
            onClick={() => action({ action: 'list' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontSize: 12,
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            <RotateCw size={13} className={busy ? 'spin' : ''} />
            <span>AGGIORNA</span>
          </button>

          <button
            disabled={busy}
            onClick={() => action({ action: 'recover' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontSize: 12,
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            <History size={13} />
            <span>RECUPERA OPERAZIONE INTERROTTA</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
            Categoria importazione:
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {labelIt(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            color: '#991b1b',
            fontSize: 13,
          }}
        >
          <MessageIt value={error} />
        </div>
      )}

      {/* ITEMS LIST */}
      {filteredItems.length === 0 ? (
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: 8,
            color: '#64748b',
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div>Nessuna proposta o risposta trovata in questa vista.</div>
          {kind === 'proposal' && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Puoi importare una bozza compilata da revisionare usando la sezione sottostante.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
          {filteredItems.map((i) => (
            <Review key={i.id} item={i} busy={busy} category={category} action={action} />
          ))}
        </div>
      )}

      {/* IMPORT SECTION */}
      {kind === 'proposal' && (
        <details
          style={{
            marginTop: 16,
            padding: 16,
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
          }}
        >
          <summary style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}>
            Importa una bozza compilata da revisionare ({drafts.length} disponibili)
          </summary>
          <p style={{ fontSize: 12, color: '#475569', margin: '8px 0 16px 0' }}>
            Importa una copia conservando la provenienza. Le bozze originali e l’indice di compilazione restano invariati.
          </p>
          {drafts.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Nessuna bozza non importata trovata in 90_PROPOSALS/.</div>
          ) : (
            drafts.map((d) => (
              <details
                key={d.relative_path}
                style={{
                  marginBottom: 10,
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: 12,
                }}
              >
                <summary style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#0f172a' }}>
                  {d.title} · <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{d.relative_path}</span>
                </summary>
                <pre
                  style={{
                    maxHeight: 180,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontSize: 11,
                    backgroundColor: '#f8fafc',
                    padding: 10,
                    borderRadius: 4,
                    border: '1px solid #e2e8f0',
                    margin: '10px 0',
                  }}
                >
                  {d.markdown}
                </pre>
                <button
                  disabled={busy}
                  onClick={async () => {
                    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(d.markdown));
                    const hash = Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
                    await action({
                      action: 'import',
                      operationId: operationId(),
                      sourcePath: d.relative_path,
                      expectedSha256: hash,
                      title: d.title,
                      category,
                    });
                  }}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  IMPORTA BOZZA MOSTRATA
                </button>
              </details>
            ))
          )}
        </details>
      )}
    </div>
  );
}

function Review({
  item: i,
  busy,
  category: defaultCategory,
  action,
}: {
  item: M7Item;
  busy: boolean;
  category: string;
  action: (r: Record<string, unknown>) => Promise<void>;
}) {
  const latest = i.revisions[i.revisions.length - 1];
  const text = i.versions[i.versions.length - 1].markdown;
  const [edit, setEdit] = useState('');
  const [reason, setReason] = useState('');

  const dirIndex = Math.max(0, categories.indexOf(i.category || defaultCategory));
  const suggestedTarget = `${dirs[dirIndex]}/${toSlug(i.title)}.md`;
  const [target, setTarget] = useState(suggestedTarget);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const idx = Math.max(0, categories.indexOf(i.category || defaultCategory));
    setTarget(`${dirs[idx]}/${toSlug(i.title)}.md`);
    setEdit('');
    setConfirm(false);
  }, [i.id, latest.sha256, i.category, i.title, defaultCategory]);

  const base = { id: i.id, revision: latest.revision, expectedSha256: latest.sha256 };

  const isPending = i.workflowStatus === 'pending';
  const isApproved = i.workflowStatus === 'approved';
  const isRejected = i.workflowStatus === 'rejected';

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1.5px solid #cbd5e1',
        borderRadius: 10,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* PROPOSAL HEADER */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px 0', color: '#0f172a' }}>
              {i.title}
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 4,
                  backgroundColor: isPending ? '#fef9c3' : isApproved ? '#dcfce7' : '#fee2e2',
                  color: isPending ? '#854d0e' : isApproved ? '#15803d' : '#b91c1c',
                }}
              >
                {labelIt(i.workflowStatus)}
              </span>

              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, backgroundColor: '#f1f5f9', color: '#475569' }}>
                Revisione {latest.revision}
              </span>

              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, backgroundColor: '#f1f5f9', color: '#475569' }}>
                {labelIt(i.category)} ({dirs[categories.indexOf(i.category)] || dirs[0]})
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
            <div>{labelIt(i.origin)} {i.provider ? `(${i.provider} - ${i.model})` : ''}</div>
            <div style={{ fontFamily: 'monospace', marginTop: 2 }}>SHA-256: {latest.sha256.substring(0, 16)}...</div>
          </div>
        </div>

        {i.sourceWarnings.length > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: '#fffbeb', border: '1px solid #fef08a', borderRadius: 6, fontSize: 12, color: '#854d0e' }}>
            {i.sourceWarnings.map((w) => (
              <p role="status" key={w} style={{ margin: 0 }}>
                <MessageIt value={w} />
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ACTION SECTION IF OUTPUT */}
      {i.kind === 'output' && (
        <div style={{ marginBottom: 16 }}>
          <button
            disabled={busy}
            onClick={() =>
              action({
                action: 'create',
                operationId: operationId(),
                id: i.id,
                expectedSha256: latest.sha256,
                title: i.title,
                category: defaultCategory,
              })
            }
            style={{
              backgroundColor: busy ? '#94a3b8' : '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            CREA PROPOSTA DALLA RISPOSTA SALVATA
          </button>
        </div>
      )}

      {/* ACTION SECTION IF PROPOSAL AND PENDING */}
      {isPending && (
        <div style={{ marginBottom: 20 }}>
          {/* PRIMARY APPROVAL BOX (IN PIENO RISALTO) */}
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: 8,
              padding: 18,
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FolderCheck size={20} color="#15803d" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#14532d' }}>
                Approva revisione e inserisci nella Conoscenza del Vault
              </span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#166534', display: 'block', marginBottom: 6 }}>
                Nuova destinazione (.md):
              </label>
              <input
                aria-label="Destinazione della nota approvata"
                value={target}
                placeholder={`${dirs[categories.indexOf(i.category)] || dirs[0]}/nuova-nota.md`}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setConfirm(false);
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1.5px solid #86efac',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 11, color: '#15803d', marginTop: 4, display: 'block' }}>
                Indica un file nuovo nella categoria della proposta. Le note esistenti non vengono sovrascritte.
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 6, borderTop: '1px solid #bbf7d0' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#14532d',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#15803d', cursor: 'pointer' }}
                />
                Ho verificato questa revisione e la destinazione indicata.
              </label>

              <button
                disabled={busy || !confirm || !target.trim()}
                onClick={() =>
                  action({
                    ...base,
                    action: 'approve',
                    operationId: operationId(),
                    targetPath: target.trim(),
                  })
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: busy || !confirm || !target.trim() ? '#94a3b8' : '#15803d',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 22px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: busy || !confirm || !target.trim() ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.15s ease',
                }}
              >
                <CheckCircle2 size={16} />
                <span>APPROVA REVISIONE MOSTRATA</span>
              </button>
            </div>
          </div>

          {/* SECONDARY ACTIONS: REVISE OR REJECT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* ACCORDION: MODIFICA / SALVA NUOVA REVISIONE */}
            <details
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <summary
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0f172a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Edit3 size={15} />
                <span>Modifica testo (Crea nuova revisione)</span>
              </summary>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Testo della nuova revisione:
                </label>
                <textarea
                  aria-label="Testo della nuova revisione"
                  value={edit}
                  onChange={(e) => setEdit(e.target.value)}
                  placeholder="Inserisci o modifica il testo Markdown qui..."
                  style={{
                    width: '100%',
                    minHeight: 120,
                    padding: 8,
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                />

                {edit.trim() && (
                  <details open style={{ marginTop: 8, fontSize: 12 }}>
                    <summary style={{ fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                      Confronta testo attuale con la revisione proposta
                    </summary>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 2 }}>Testo attuale</div>
                        <pre
                          style={{
                            maxHeight: 140,
                            overflowY: 'auto',
                            backgroundColor: '#ffffff',
                            padding: 8,
                            borderRadius: 4,
                            border: '1px solid #e2e8f0',
                            whiteSpace: 'pre-wrap',
                            margin: 0,
                            fontSize: 11,
                          }}
                        >
                          {text.replace(/^---\n[\s\S]*?\n---\n/, '')}
                        </pre>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 2 }}>Testo proposto</div>
                        <pre
                          style={{
                            maxHeight: 140,
                            overflowY: 'auto',
                            backgroundColor: '#ffffff',
                            padding: 8,
                            borderRadius: 4,
                            border: '1px solid #e2e8f0',
                            whiteSpace: 'pre-wrap',
                            margin: 0,
                            fontSize: 11,
                          }}
                        >
                          {edit}
                        </pre>
                      </div>
                    </div>
                  </details>
                )}

                <div style={{ marginTop: 10 }}>
                  <button
                    disabled={busy || !edit.trim()}
                    onClick={() =>
                      action({
                        ...base,
                        action: 'revise',
                        operationId: operationId(),
                        content: edit,
                      })
                    }
                    style={{
                      backgroundColor: busy || !edit.trim() ? '#94a3b8' : '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: busy || !edit.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    SALVA NUOVA REVISIONE (CONSERVA LA PRECEDENTE)
                  </button>
                </div>
              </div>
            </details>

            {/* ACCORDION: RIFIUTA REVISIONE */}
            <details
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <summary
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#991b1b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <XCircle size={15} />
                <span>Rifiuta questa revisione</span>
              </summary>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', display: 'block', marginBottom: 4 }}>
                  Motivo del rifiuto:
                </label>
                <input
                  aria-label="Motivo del rifiuto"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Indica il motivo del rifiuto..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #fca5a5',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ marginTop: 10 }}>
                  <button
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      action({
                        ...base,
                        action: 'reject',
                        operationId: operationId(),
                        reason,
                      })
                    }
                    style={{
                      backgroundColor: busy || !reason.trim() ? '#94a3b8' : '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: busy || !reason.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    RIFIUTA REVISIONE MOSTRATA
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* DECISION SUMMARY IF ALREADY PROCESSED */}
      {i.decision && (
        <div style={{ marginBottom: 16, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 6, fontSize: 12 }}>
          <strong>Decisione registrata:</strong>
          <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{JSON.stringify(i.decision, null, 2)}</pre>
        </div>
      )}

      {/* PROPOSAL TEXT PREVIEW */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
            Contenuto del documento (Revisione {latest.revision})
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {text.length} caratteri
          </span>
        </div>
        <div
          style={{
            maxHeight: 340,
            overflowY: 'auto',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: 14,
          }}
        >
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.6,
              color: '#0f172a',
            }}
          >
            {text}
          </pre>
        </div>
      </div>

      {/* METADATA ACCORDIONS */}
      <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
        <details
          style={{
            flex: 1,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: 10,
            fontSize: 12,
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
            Fonti e provenienza ({i.sources?.length ?? 0})
          </summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
            {JSON.stringify(i.sources, null, 2)}
          </pre>
        </details>

        <details
          style={{
            flex: 1,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: 10,
            fontSize: 12,
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
            Cronologia delle revisioni conservate ({i.versions.length})
          </summary>
          {i.versions.map((v) => (
            <div key={v.revision} style={{ marginTop: 8 }}>
              <strong style={{ fontSize: 11 }}>Revisione {v.revision}</strong>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: 11,
                  maxHeight: 120,
                  overflowY: 'auto',
                  backgroundColor: '#f8fafc',
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid #e2e8f0',
                  margin: '4px 0',
                }}
              >
                {v.markdown}
              </pre>
            </div>
          ))}
        </details>
      </div>
    </div>
  );
}
