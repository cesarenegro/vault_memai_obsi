import React, { useState, useMemo } from 'react';
import { getPlatformTerms } from './platform';
import {
  Search,
  BookOpen,
  Compass,
  FileText,
  FolderTree,
  FolderArchive,
  MessageSquare,
  FileCheck,
  History,
  Cloud,
  Layers,
  GraduationCap,
  Layout,
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Sparkles,
  RotateCw,
  Cpu,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface HelpSection {
  id: string;
  title: string;
  badge?: string;
  icon: React.ReactNode;
  summary: string;
  content: React.ReactNode;
}

function CodeBlock({ code, language = 'markdown' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ position: 'relative', margin: '14px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid #334155' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a',
          padding: '6px 14px',
          fontSize: 11,
          fontWeight: 600,
          color: '#94a3b8',
          borderBottom: '1px solid #1e293b',
          userSelect: 'none',
        }}
      >
        <span>{language.toUpperCase()}</span>
        <button
          onClick={handleCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            backgroundColor: copied ? '#15803d' : '#1e293b',
            color: copied ? '#ffffff' : '#cbd5e1',
            border: 'none',
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copiato!' : 'Copia'}</span>
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: 14,
          backgroundColor: '#020617',
          color: '#e2e8f0',
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: 1.6,
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        {code}
      </pre>
    </div>
  );
}

function Callout({ type, title, children }: { type: 'tip' | 'warning' | 'info'; title?: string; children: React.ReactNode }) {
  const styles = {
    tip: { bg: '#f0fdf4', border: '#86efac', text: '#166534', badgeBg: '#dcfce7', defaultTitle: 'Consiglio' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#854d0e', badgeBg: '#fef3c7', defaultTitle: 'Attenzione' },
    info: { bg: '#f8fafc', border: '#cbd5e1', text: '#1e293b', badgeBg: '#e2e8f0', defaultTitle: 'Importante' },
  }[type];

  return (
    <div
      style={{
        backgroundColor: styles.bg,
        border: `1.5px solid ${styles.border}`,
        borderRadius: 8,
        padding: '12px 16px',
        margin: '14px 0',
        color: styles.text,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, backgroundColor: styles.badgeBg }}>
          {title || styles.defaultTitle}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function HelpPanel({
  vaultPath,
  onOpenObsidian,
  onNavigateTab,
}: {
  vaultPath?: string | null;
  onOpenObsidian?: () => void;
  onNavigateTab?: (tab: string) => void;
}) {
  const terms = getPlatformTerms();
  const [activeChapterId, setActiveChapterId] = useState('rag-locale');
  const [searchQuery, setSearchQuery] = useState('');

  const chapters: HelpSection[] = useMemo(
    () => [
      {
        id: 'concetti',
        title: '1. I concetti essenziali',
        badge: 'Base',
        icon: <Compass size={16} />,
        summary: 'Cos’è un Vault, distinzione tra RAG locale e OpenAI, ciclo di vita e privacy a rete zero.',
        content: (
          <div>
            <h3>Un Vault è una cartella di lavoro {terms.onDeviceTerm}</h3>
            <p>
              Il <strong>Vault</strong> contiene note Markdown, documenti originali, bozze e indici di sistema. Rimane salvato {terms.onDeviceTerm} ed è pienamente compatibile e consultabile con Obsidian.
            </p>
            <ul>
              <li><strong>Obsidian</strong> serve per scrivere e modificare liberamente le note di conoscenza.</li>
              <li><strong>LIMEN Vault</strong> serve per consultarle, indicizzarle, estrarre trascrizioni e documenti con OCR, calcolare vettori semantici {terms.onDeviceTerm} a rete zero, fare ricerche ibride BM25 + semantiche, interrogare l’AI con anteprima locale e gestire copie verificate.</li>
            </ul>

            <h4>Due motori di intelligenza: Locale vs Rete</h4>
            <div style={{ overflowX: 'auto', margin: '14px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '8px 12px' }}>Funzionalità</th>
                    <th style={{ padding: '8px 12px' }}>Motore & Tecnologia</th>
                    <th style={{ padding: '8px 12px' }}>Dati in Rete</th>
                    <th style={{ padding: '8px 12px' }}>Costo / Token</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Ricerca Ibrida Locale (RAG)</td>
                    <td style={{ padding: '8px 12px' }}>Indice BM25 + Vettori <strong>bge-m3</strong> via <code>llama-server</code> interno</td>
                    <td style={{ padding: '8px 12px', color: '#166534', fontWeight: 700 }}>Zero Byte (100% offline su 127.0.0.1)</td>
                    <td style={{ padding: '8px 12px' }}>Gratuito, illimitato</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Chiedi al Vault (AI)</td>
                    <td style={{ padding: '8px 12px' }}>Modello OpenAI (es. gpt-4o) con chiave in {terms.keychainTerm}</td>
                    <td style={{ padding: '8px 12px', color: '#854d0e' }}>Solo le fonti mostrate in Anteprima Locale</td>
                    <td style={{ padding: '8px 12px' }}>A consumo API OpenAI</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Classificazione Automatica RAW</td>
                    <td style={{ padding: '8px 12px' }}>{terms.extractorTerm} + chiamata OpenAI opt-in</td>
                    <td style={{ padding: '8px 12px', color: '#854d0e' }}>Solo se automazione attivata dall’utente</td>
                    <td style={{ padding: '8px 12px' }}>A consumo API OpenAI</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Callout type="info" title="Privacy e Garanzia Rete Zero">
              Con il fornitore semantico <strong>Locale</strong>, nessun dato lascia mai {terms.deviceTerm}. Il calcolo degli embedding semantici e la ricerca lessicale BM25 avvengono esclusivamente sulla memoria locale tramite socket di loopback interno (<code>127.0.0.1</code>), verificato e isolato.
            </Callout>
          </div>
        ),
      },
      {
        id: 'primi-passi',
        title: '2. Primi passi',
        badge: 'Guida rapida',
        icon: <GraduationCap size={16} />,
        summary: 'Aprire o creare un Vault, configurare il RAG locale, collegare Obsidian e prime ricerche.',
        content: (
          <div>
            <h3>Guida rapida in 4 passi</h3>

            <h4>Passo 1 — Apri o crea il Vault</h4>
            <ol>
              <li>Avvia <strong>LIMEN Vault V5</strong> {terms.onDeviceTerm}.</li>
              <li>Nella schermata di benvenuto, seleziona il percorso della cartella locale.</li>
              <li>Premi <strong>APRI VAULT ESISTENTE</strong> se possiedi già un Vault LIMEN, oppure <strong>CREA NUOVO VAULT</strong> se la cartella è vuota.</li>
            </ol>
            <p><strong>Risultato atteso:</strong> la schermata si apre sulla <strong>Panoramica</strong> con stato <strong>Pronto</strong>.</p>

            <h4>Passo 2 — Configura il RAG Locale (100% Offline)</h4>
            <ol>
              <li>Vai in <strong>Avanzate e Manutenzione → Collegamenti AI & MCP</strong>.</li>
              <li>Nel pannello <strong>Motore semantico</strong>, assicurati che sia selezionato <strong>Locale (bge-m3, nessun dato esce {terms.fromDeviceTerm})</strong>.</li>
              <li>Se il modello non è installato, premi <strong>SCARICA MODELLO (635 MB)</strong> oppure <strong>SELEZIONA FILE GGUF DA DISCO…</strong> per un file già presente sul disco.</li>
              <li>Premi <strong>AVVIA SERVIZIO LOCALE</strong>: il sistema avvierà <code>llama-server</code> su una porta libera locale e verificherà la salute (<code>/health</code>).</li>
              <li>Se la cache indica disallineamento, premi <strong>RICALCOLA CACHE</strong> per generare i vettori semantici {terms.onDeviceTerm}.</li>
            </ol>

            <h4>Passo 3 — Collega Obsidian</h4>
            <ol>
              <li>Premi il pulsante <strong>Apri in Obsidian</strong> in basso a sinistra.</li>
              <li>Se Obsidian non conosce ancora la cartella, scegli <em>Open folder as vault</em> e indica il percorso del Vault.</li>
              <li>Torna in LIMEN: ora puoi consultare e scrivere liberamente.</li>
            </ol>

            <h4>Passo 4 — Carica documenti e fai domande</h4>
            <p>
              Premi il pulsante verde <strong>CARICA DOCUMENTI</strong> per importare PDF, presentazioni, trascrizioni o fogli di calcolo in <code>20_RAW_SOURCES</code>. L’estrattore nativo estrae il testo in passaggi; poi vai nella scheda <strong>Chiedi</strong>, scrivi la tua domanda e premi Invio o il pulsante <strong>Chiedi</strong>. LIMEN risponderà in prosa in stile chat a messaggistica con le fonti consultate posizionate sotto la risposta in un blocco richiudibile.
            </p>
          </div>
        ),
      },
      {
        id: 'rag-locale',
        title: '3. Motore Semantico & RAG 100% Locale',
        badge: 'RAG Locale',
        icon: <Sparkles size={16} />,
        summary: `Come funziona bge-m3 su ${terms.osName}: modello Q8_0, porta dinamica, salute /health, zero rete e staging.`,
        content: (
          <div>
            <h3>Architettura del RAG Locale integrato</h3>
            <p>
              LIMEN Vault V5 integra un motore di intelligenza semantica locale basato su <strong>llama-server</strong> e il modello <strong>BAAI/bge-m3</strong> quantizzato a 8 bit (<code>bge-m3-Q8_0.gguf</code>, 1024 dimensioni).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '16px 0' }}>
              <div style={{ padding: 14, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>Caratteristiche del Modello Locale</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                  <li><strong>Modello:</strong> bge-m3-Q8_0.gguf</li>
                  <li><strong>Dimensioni vettore:</strong> 1024 float</li>
                  <li><strong>Dimensione file:</strong> 605,2 MB (634.553.760 byte)</li>
                  <li><strong>SHA-256 atteso:</strong> <code>950f4a8e5e19477a...</code></li>
                  <li><strong>Percorso:</strong> <code>{terms.modelsPath}</code></li>
                </ul>
              </div>

              <div style={{ padding: 14, backgroundColor: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#166534', marginBottom: 4 }}>Isolamento di Sicurezza</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#14532d', lineHeight: 1.6 }}>
                  <li><strong>Endpoint dinamico:</strong> <code>http://127.0.0.1:&lt;porta_libera&gt;/v1/embeddings</code></li>
                  <li><strong>Nessuna porta cablata:</strong> assegnata a runtime tramite socket OS</li>
                  <li><strong>Controllo Loopback:</strong> qualsiasi richiesta esterna viene respinta</li>
                  <li><strong>Nessuna API Key:</strong> non serve e non viene interrogata la {terms.keychainTerm}</li>
                  <li><strong>Processo monitorato:</strong> arresto pulito alla chiusura dell’app</li>
                </ul>
              </div>
            </div>

            <h4>Il Pannello «Motore semantico» (Avanzate → Collegamenti AI & MCP)</h4>
            <p>
              Dal pannello dedicato puoi controllare ogni aspetto del RAG locale:
            </p>
            <ul>
              <li><strong>Scelta Fornitore:</strong> scegli tra <em>Locale (bge-m3)</em> e <em>OpenAI (text-embedding-3-small)</em> con un clic. Nessun URL da digitare a mano.</li>
              <li><strong>Installazione Modello:</strong> visualizza lo stato (<em>INSTALLATO (SHA-256 OK)</em>), consente il download progressivo con barra percentuale oppure la selezione di un file <code>.gguf</code> preesistente con verifica automatica del checksum.</li>
              <li><strong>Controllo Servizio:</strong> mostra lo stato (<em>ATTIVO (PORTA n)</em> / <em>SPENTO</em> / <em>ERRORE</em>), con pulsanti per avviare, arrestare o aggiornare lo stato del processo. In caso di anomalia, le ultime righe di log di <code>llama-server.log</code> vengono mostrate a video.</li>
              <li><strong>Cache del Vault:</strong> mostra il numero di passaggi vettorializzati nel Vault e segnala se la cache è allineata a 1024 dimensioni. In caso di cambio fornitore o nuovi documenti, un pulsante consente il ricalcolo.</li>
            </ul>

            <h4>Migrazione Atomica della Cache con Staging</h4>
            <p>
              Quando si ricalcola la cache, LIMEN scrive i nuovi vettori in un file temporaneo <code>00_SYSTEM/EMBEDDINGS_CACHE.staging.json</code>. La cache precedente rimane pienamente funzionante durante tutto il calcolo. Solo al raggiungimento del 100% la nuova cache viene promossa atomicamente. Se il processo viene interrotto o l’app chiusa, l’operazione può essere ripresa senza dover ripartire da zero.
            </p>
          </div>
        ),
      },
      {
        id: 'ricerca-ibrida',
        title: '4. Ricerca Ibrida (BM25 + Semantica)',
        badge: 'Ricerca v3',
        icon: <Search size={16} />,
        summary: 'Come opera la ricerca: formula BM25 normalizzata sulla lunghezza, fusione semantica F2 e banner degradato.',
        content: (
          <div>
            <h3>I due canali della Ricerca Ibrida</h3>
            <p>
              Nella scheda <strong>Chiedi</strong>, la casella <strong>Ricerca Ibrida</strong> unisce i punti di forza del testo esatto e dell’intelligenza vettoriale:
            </p>

            <div style={{ overflowX: 'auto', margin: '14px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '8px 12px' }}>Canale</th>
                    <th style={{ padding: '8px 12px' }}>Algoritmo & Formula</th>
                    <th style={{ padding: '8px 12px' }}>Cosa trova meglio</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>1. Lessicale (BM25)</td>
                    <td style={{ padding: '8px 12px' }}>
                      BM25 con <code>k1=1,2</code>, <code>b=0,75</code> e fattore di lunghezza documento <code>dl / avgdl</code>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      Nomi propri, codici di progetto, sigle, termini tecnici esatti, parole rare
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>2. Semantico (Vettoriale)</td>
                    <td style={{ padding: '8px 12px' }}>
                      Similarità coseno su vettori contestualizzati a 1024 dimensioni (bge-m3)
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      Sinonimi, concetti affini (es. <em>private label</em> per <em>marca privata</em>), parafrasi
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4>Come vengono fusi i risultati (Formula F2)</h4>
            <p>
              I candidati dei due motori vengono riconciliati con <strong>coalescenza per documento</strong> (azzerando duplicati in classifica). I punteggi lessicali e semantici vengono normalizzati su scala min-max e combinati con la formula:
            </p>
            <div style={{ padding: '10px 14px', backgroundColor: '#f1f5f9', borderRadius: 6, fontFamily: 'monospace', fontSize: 13, margin: '10px 0' }}>
              Punteggio = max(lessicale, semantico) + 0,20 × min(lessicale, semantico) + bonus_esatto
            </div>
            <p style={{ fontSize: 13, color: '#475569' }}>
              Se un documento eccelle sia nel significato sia nelle parole esatte, riceve un forte incremento; se compare solo in uno dei due rami, non viene penalizzato ingiustamente.
            </p>

            <h4>Che cos’è la Modalità Degradata (Banner Giallo)?</h4>
            <div
              role="alert"
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                backgroundColor: '#fffbeb',
                border: '1px solid #fef3c7',
                color: '#92400e',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                margin: '14px 0',
              }}
            >
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <strong>Modalità degradata (solo ricerca lessicale):</strong> se il servizio locale <code>llama-server</code> è spento, è caduto o non risponde entro il timeout, LIMEN non si blocca e non va mai in errore: esegue la ricerca sfruttando l’indice lessicale BM25.
              </div>
            </div>
            <p>
              Quando scatta la modalità degradata:
            </p>
            <ul>
              <li><strong>Nessun dato esce {terms.fromDeviceTerm}:</strong> l’applicazione non ripiega mai silenziosamente su OpenAI se il fornitore è locale.</li>
              <li><strong>Segnalazione visiva:</strong> compare il banner giallo e il badge accanto ai risultati indica <em>RAG LOCALE SPENTO (SOLO LESSICALE)</em>.</li>
              <li><strong>Ripristino:</strong> vai in <em>Avanzate → Collegamenti AI & MCP → Motore semantico</em> e premi <strong>AVVIA SERVIZIO LOCALE</strong> (il banner non ha pulsanti); il ricalcolo della cache avvia il servizio da solo, la ricerca no.</li>
            </ul>
          </div>
        ),
      },
      {
        id: 'fonti',
        title: '5. Caricamento e conoscenza automatica',
        badge: 'RAW',
        icon: <FolderArchive size={16} />,
        summary: 'Carica file grezzi in 20_RAW_SOURCES: estrazione nativa, chunking a 1200 caratteri e indicizzazione.',
        content: (
          <div>
            <h3>La pipeline di ingestione dei documenti</h3>
            <p>
              La cartella <code>20_RAW_SOURCES/</code> è il deposito protetto per i materiali originali. I file caricati rimangono <strong>immutabili e in sola lettura</strong>.
            </p>

            <h4>Formati supportati dall’estrattore nativo</h4>
            <ul>
              <li><strong>Testo e Markdown:</strong> <code>.txt</code>, <code>.md</code> letti direttamente.</li>
              <li><strong>Documenti e Presentazioni:</strong> <code>.pdf</code>, <code>.docx</code>, <code>.pptx</code>, <code>.xlsx</code>.</li>
              <li><strong>Immagini e Scansioni:</strong> {terms.ocrDescription}</li>
            </ul>

            <h4>Come vengono segmentati i passaggi (Chunking)</h4>
            <p>
              I testi estratti vengono suddivisi in passaggi di circa <strong>1.200 caratteri</strong> con sovrapposizione di 150 caratteri. I paragrafi lunghi sono spezzati su confini di frase. Le intestazioni di pagina (es. <code>## Pagina 3</code> o <code>## Slide 5</code>) fungono da cesura netta e generano il <strong>locator</strong> del passaggio.
            </p>
            <p>
              Per ogni passaggio, il testo inviato al calcolo semantico viene <strong>contestualizzato</strong>: il titolo del documento, la categoria e il locator vengono anteposti al testo, garantendo che anche passaggi brevi o frammentari mantengano il contesto semantico originale del documento.
            </p>
          </div>
        ),
      },
      {
        id: 'note',
        title: '6. Note e cartelle di conoscenza',
        badge: 'Struttura',
        icon: <FolderTree size={16} />,
        summary: 'Mappatura delle cartelle da 01 a 10, RAW, Frontmatter YAML e proprietà obbligatorie.',
        content: (
          <div>
            <h3>Struttura del Vault Obsidian-compatibile</h3>
            <div style={{ overflowX: 'auto', margin: '14px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '8px 12px' }}>Cartella</th>
                    <th style={{ padding: '8px 12px' }}>Tipo contenuto</th>
                    <th style={{ padding: '8px 12px' }}>Proprietà <code>type</code></th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td style={{ padding: '6px 12px' }}><code>01_CLIENTS/</code></td><td>Schede e profili clienti</td><td><code>client</code></td></tr>
                  <tr><td style={{ padding: '6px 12px' }}><code>02_PROJECTS/</code></td><td>Schede di progetto e deliverable</td><td><code>project</code></td></tr>
                  <tr><td style={{ padding: '6px 12px' }}><code>03_BRANDS/</code></td><td>Marchi e identità di marca</td><td><code>brand</code></td></tr>
                  <tr><td style={{ padding: '6px 12px' }}><code>04_POSITIONING/</code></td><td>Strategie di posizionamento</td><td><code>positioning</code></td></tr>
                  <tr><td style={{ padding: '6px 12px' }}><code>05_PACKAGING_KNOWLEDGE/</code></td><td>Conoscenza tecnica su packaging e materiali</td><td><code>packaging</code></td></tr>
                  <tr><td style={{ padding: '6px 12px' }}><code>06_METHODS/</code></td><td>Metodologie operative e checklist</td><td><code>method</code></td></tr>
                  <tr><td style={{ padding: '6px 12px' }}><code>07_CASE_STUDIES/</code></td><td>Casi studio e risultati</td><td><code>case_study</code></td></tr>
                  <tr><td style={{ padding: '6px 12px' }}><code>08_MARKET_RESEARCH/</code></td><td>Ricerche di settore e trend</td><td><code>research</code></td></tr>
                  <tr><td style={{ padding: '6px 12px' }}><code>09_COMPETITORS/</code></td><td>Analisi della concorrenza</td><td><code>competitor</code></td></tr>
                  <tr><td style={{ padding: '6px 12px' }}><code>10_APPROVED_OUTPUTS/</code></td><td>Deliverable definitivi approvati</td><td><code>approved_output</code></td></tr>
                  <tr><td style={{ padding: '6px 12px' }}><code>20_RAW_SOURCES/</code></td><td>Documenti grezzi, brief, trascrizioni</td><td><code>raw_source</code></td></tr>
                </tbody>
              </table>
            </div>

            <h4>Esempio di Frontmatter YAML corretto</h4>
            <CodeBlock
              language="markdown"
              code={`---
schema_version: 1
id: cliente-acme
title: "Cliente Acme SpA"
type: client
client: cliente-acme
status: approved
created_at: "2026-09-20T10:00:00Z"
updated_at: "2026-09-20T10:00:00Z"
tags: [pasta, packaging, bio]
---

# Cliente Acme SpA

Produttore italiano di prodotti da forno.
Richiede soluzioni di packaging compostabile.`}
            />
          </div>
        ),
      },
      {
        id: 'ai',
        title: '7. Chiedi al Vault (Conversazione & AI)',
        badge: 'Chat & RAG',
        icon: <MessageSquare size={16} />,
        summary: 'Conversazione a più turni con contesto, stile messaggistica, fonti verificate sotto la risposta e storico.',
        content: (
          <div>
            <h3>Conversazione a messaggistica e intelligenza aumentata</h3>
            <p>
              La scheda <strong>Chiedi al Vault</strong> ti consente di dialogare direttamente con la conoscenza aziendale accumulata nel Vault attraverso un'interfaccia a messaggistica fluida e trasparente:
            </p>

            <h4>Caratteristiche e Funzionalità Principali</h4>
            <ul>
              <li>
                <strong>Conversazione a più turni con contesto:</strong> ogni domanda di seguito mantiene automaticamente il contesto dei turni precedenti. Puoi fare approfondimenti consecutivi (es. <em>«E quali app comprende?»</em>, <em>«Chi le usa?»</em>) senza dover ripetere il soggetto.
              </li>
              <li>
                <strong>Stile messaggistica moderno:</strong> le tue domande compaiono allineate a destra con sfondo verde lime (<code>#77F117</code>) e testo scuro ben leggibile; le risposte sintetizzate dall'AI compaiono a sinistra in riquadri bianchi distinti.
              </li>
              <li>
                <strong>Pulsante «Nuova conversazione»:</strong> posizionato in alto a destra nel riquadro verde lime al 30% e in calce all'input, permette di azzerare istantaneamente il contesto precedente e iniziare una nuova sessione pulita.
              </li>
              <li>
                <strong>Fonti consultate e citate SOTTO la risposta:</strong> le fonti estratte dal Vault sono posizionate rigorosamente sotto il testo della risposta, sia nei turni completati sia durante lo streaming. Il blocco è richiudibile e chiuso all'inizio (<code>sourcesOpen: false</code>) per non distrarre dalla lettura.
              </li>
              <li>
                <strong>Nomi delle fonti leggibili:</strong> le fonti mostrano il titolo pulito senza estensione né prefissi tecnici, la categoria in chiaro (es. <em>Documento caricato</em> al posto di <code>raw_source</code>) e i paragrafi raggruppati (es. <em>Paragrafi 1–13, 52–68</em>).
              </li>
              <li>
                <strong>Storico delle conversazioni («Storico»):</strong> il cassetto laterale raggruppa le domande di seguito nella stessa sessione di dialogo, indicando il numero di turni, i token consumati, il modello utilizzato e lo stato di integrità di ciascuna fonte (inalterata, modificata o rimossa).
              </li>
              <li>
                <strong>Riservatezza assoluta:</strong> con il motore semantico locale bge-m3, la ricerca dei passaggi avviene a rete zero sul computer; a OpenAI vengono trasmessi unicamente i passaggi rilevanti selezionati. Nessun dato non pertinente esce dal dispositivo.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'proposte',
        title: '8. Revisione e approvazione',
        badge: 'Governance',
        icon: <FileCheck size={16} />,
        summary: 'Come approvare bozze da 90_PROPOSALS alle cartelle di conoscenza definitiva 01-10.',
        content: (
          <div>
            <h3>Flusso governato delle proposte</h3>
            <p>
              La sezione <strong>Proposte</strong> permette di revisionare bozze prodotte da compilazioni o risposte AI prima che entrino nella conoscenza ufficiale:
            </p>
            <ol>
              <li>Apri <strong>Proposte</strong> dalla barra laterale.</li>
              <li>Controlla la <strong>Nuova destinazione (.md)</strong> proposta (es. <code>04_POSITIONING/strategia.md</code>).</li>
              <li>Spunta la casella obbligatoria: <em>“Ho verificato questa revisione e la destinazione indicata”</em>.</li>
              <li>Premi il pulsante verde <strong>APPROVA REVISIONE MOSTRATA</strong>.</li>
            </ol>
            <p>
              La nota entra istantaneamente nella cartella del Vault con <code>status: approved</code>, preservando la cronologia di audit.
            </p>
          </div>
        ),
      },
      {
        id: 'copie',
        title: '9. Copie locali e integrità',
        badge: 'Sicurezza',
        icon: <History size={16} />,
        summary: 'Snapshot crittografici SHA-256 in 00_SYSTEM/SNAPSHOTS e ripristino sicuro.',
        content: (
          <div>
            <h3>Integrità crittografica del Vault</h3>
            <p>
              La sezione <strong>Copie locali</strong> confronta l’intero contenuto del Vault rispetto al manifesto crittografico SHA-256.
            </p>
            <ul>
              <li><strong>Verificata:</strong> tutti i file corrispondono esattamente alle impronte registrate.</li>
              <li><strong>Differenze rilevate:</strong> elenca i file modificati, mancanti o aggiunti rispetto all’ultimo manifesto.</li>
              <li><strong>Crea copia locale:</strong> genera uno snapshot completo e immutabile in <code>00_SYSTEM/SNAPSHOTS/</code>.</li>
            </ul>
          </div>
        ),
      },
      {
        id: 'trasferimenti',
        title: '10. Trasferimenti e Cloud R2',
        badge: 'Cloud R2',
        icon: <Cloud size={16} />,
        summary: 'Sincronizzazione su Cloudflare R2: pubblicazione per il CRM e canale privato di backup.',
        content: (
          <div>
            <h3>Sincronizzazione cloud sicura</h3>
            <p>
              La sezione <strong>Trasferimenti</strong> gestisce la comunicazione sicura con l’archivio Cloudflare R2:
            </p>
            <ul>
              <li><strong>Canale Pubblicato (CRM):</strong> trasmette esclusivamente le note approvate delle cartelle da 01 a 10 selezionate per la consultazione aziendale.</li>
              <li><strong>Canale Privato:</strong> copia di sicurezza crittografata dell’intero Vault, protetta da chiavi dedicate e non accessibile al CRM.</li>
            </ul>
          </div>
        ),
      },
      {
        id: 'workflows',
        title: '11. Workflow operativi ed esempi',
        badge: 'Guide Pratiche',
        icon: <Compass size={16} />,
        summary: 'Procedure passo-passo illustrate: primo avvio RAG locale, ricerca ibrida, ripristino e allineamento cache.',
        content: (
          <div>
            <h3>Procedure operative guidate</h3>

            <h4>Workflow 1 — Configurazione e Primo Avvio del RAG Locale 100% Offline</h4>
            <div style={{ padding: 14, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 16 }}>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
                <li>Apri <strong>Avanzate e Manutenzione → Collegamenti AI & MCP</strong>.</li>
                <li>Nel riquadro <strong>Motore semantico</strong>, seleziona <strong>Locale (bge-m3, nessun dato esce dal Mac)</strong>.</li>
                <li>Se il riquadro <em>Modello locale</em> indica <em>Non installato</em>, premi <strong>SCARICA MODELLO (635 MB)</strong> e attendi il completamento con verifica automatica dell’hash SHA-256.</li>
                <li>Premi <strong>AVVIA SERVIZIO LOCALE</strong>: l’app avvierà <code>llama-server</code> su una porta dinamica libera (es. <code>59667</code>) e mostrerà il badge verde <strong>ATTIVO</strong>.</li>
                <li>Se il riquadro <em>Cache semantica</em> segnala passaggi mancanti o disallineati, premi <strong>RICALCOLA CACHE</strong> per completare l’indicizzazione vettoriale.</li>
              </ol>
            </div>

            <h4>Workflow 2 — Ricerca Ibrida Quotidiana e Gestione Modalità Degradata</h4>
            <div style={{ padding: 14, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 16 }}>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
                <li>Vai nella scheda <strong>Chiedi (Ricerca nel Vault)</strong>.</li>
                <li>Assicurati che la casella <strong>Ricerca Ibrida</strong> sia spuntata.</li>
                <li>Digita i termini cercati (es. <em>posizionamento di marca</em> o <em>private label</em>) e premi Invio.</li>
                <li>I risultati combinano la corrispondenza lessicale BM25 e la vicinanza concettuale bge-m3. Ciascun risultato mostra titolo, snippet e locator di pagina/paragrafo.</li>
                <li><strong>Se compare il banner giallo ⚠️ Modalità degradata:</strong> significa che il processo locale è caduto o è stato arrestato. La ricerca continua comunque a funzionare in solo lessicale BM25. Per riattivare il semantico, vai in <em>Avanzate → Collegamenti AI & MCP → Motore semantico</em> e premi <strong>AVVIA SERVIZIO LOCALE</strong>.</li>
              </ol>
            </div>

            <h4>Workflow 3 — Migrazione Fornitore e Ricalcolo Sicuro della Cache</h4>
            <div style={{ padding: 14, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 16 }}>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
                <li>Se decidi di passare da OpenAI (1536 dim) a Locale (1024 dim), apri il pannello <strong>Motore semantico</strong>.</li>
                <li>Seleziona il fornitore desiderato: LIMEN aggiorna il profilo e segnala che le dimensioni della cache attuale differiscono da quelle del nuovo fornitore.</li>
                <li>Premi <strong>RICALCOLA CACHE</strong>: il sistema genera un file transitorio sicuro <code>00_SYSTEM/EMBEDDINGS_CACHE.staging.json</code>.</li>
                <li>La vecchia cache rimane utilizzabile durante tutto il calcolo. Al raggiungimento del 100%, la nuova cache viene promossa automaticamente.</li>
              </ol>
            </div>

            <h4>Workflow 4 — Dal Documento Grezzo alla Conoscenza Approvata</h4>
            <div style={{ padding: 14, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #cbd5e1' }}>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
                <li>Carica il file originale (PDF, DOCX, TXT) premendo <strong>CARICA DOCUMENTI</strong> in alto a sinistra.</li>
                <li>L’estrattore crea i passaggi e li inserisce nel catalogo e nell’indice di ricerca.</li>
                <li>Trova il passaggio pertinente tramite <strong>Ricerca Ibrida</strong> e aprilo nel Lettore verificando l’integrità crittografica SHA-256.</li>
                <li>Usa il compilatore per creare una proposta in <code>90_PROPOSALS/</code>.</li>
                <li>Apri <strong>Proposte</strong>, revisiona il testo, spunta la conferma e premi <strong>APPROVA</strong>: la nota entra nella cartella di destinazione prescelta (da 01 a 10).</li>
              </ol>
            </div>
          </div>
        ),
      },
      {
        id: 'problemi',
        title: '12. Problemi comuni e soluzioni',
        badge: 'FAQ & Guasti',
        icon: <AlertCircle size={16} />,
        summary: 'Risoluzione rapida di dubbi, errori di avvio del servizio locale, banner degradato e cache.',
        content: (
          <div>
            <h3>Domande frequenti e risoluzione problemi</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <details style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
                <summary style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  Perché compare il banner giallo «Modalità degradata (solo ricerca lessicale)»?
                </summary>
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  Il banner compare quando hai attiva la <em>Ricerca Ibrida</em> ma il servizio semantico locale (<code>llama-server</code>) non è in esecuzione, non risponde entro il timeout o è stato arrestato. In questa modalità, l’applicazione garantisce la continuità operativa calcolando i risultati con il solo motore lessicale BM25. Nessun dato lascia {terms.deviceTerm}. Per ripristinare la semantica, vai in <strong>Avanzate → Collegamenti AI & MCP → Motore semantico</strong> e premi <strong>AVVIA SERVIZIO LOCALE</strong>.
                </div>
              </details>

              <details style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
                <summary style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  Il servizio locale segnala errore all’avvio o «exit status 1»
                </summary>
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  Verifica che il modello sia integro aprendo la scheda <em>Motore semantico</em> (deve riportare <em>INSTALLATO (SHA-256 OK)</em>). Se l’errore persiste, consulta il file di log dettagliato generato dal processo in:
                  <br />
                  <code>{terms.modelsLogPath}</code>.
                </div>
              </details>

              <details style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
                <summary style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  La cache semantica mostra «assente», «Disallineamento dimensioni vettore» o «incompleta»
                </summary>
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  Questo accade se hai cambiato fornitore (es. da OpenAI con 1536 dimensioni a Locale bge-m3 con 1024 dimensioni) o se hai aggiunto nuovi documenti in <code>20_RAW_SOURCES</code>. Premi <strong>RICALCOLA CACHE SEMANTICA (1024 DIM)</strong> nel pannello del motore semantico: il servizio locale parte da solo se è spento, la barra mostra «K/N passaggi» e la percentuale, la cache precedente resta in uso fino al 100%. Durata indicativa: ~9.400 passaggi in ~45–50 minuti (misurata con accelerazione locale).
                </div>
              </details>

              <details style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
                <summary style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  Una nota appena creata o modificata non compare nella Ricerca
                </summary>
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  L’indice lessicale non viene riscritto a ogni singola battuta per risparmiare CPU e batteria. Vai nella schermata <strong>Chiedi (Ricerca)</strong> e premi <strong>AGGIORNA INDICE</strong>, oppure usa il pulsante <strong>Aggiorna</strong> al centro della barra superiore dell’applicazione.
                </div>
              </details>

              <details style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
                <summary style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  Obsidian non apre automaticamente la cartella del Vault
                </summary>
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  Al primissimo avvio Obsidian deve registrare la cartella. In Obsidian seleziona <em>Open folder as vault</em> e indica il percorso del tuo Vault. Al secondo clic su <strong>Apri in Obsidian</strong> da LIMEN, il Vault si aprirà istantaneamente.
                </div>
              </details>

              <details style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
                <summary style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  Il pulsante di approvazione proposta in Proposte è disabilitato
                </summary>
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  Per ragioni di integrità e audit, l’approvazione richiede due condizioni: 1) un percorso file valido in <em>Nuova destinazione (.md)</em> in una cartella consentita (da 01 a 10), e 2) la spunta attiva sulla casella <em>“Ho verificato questa revisione e la destinazione indicata”</em>.
                </div>
              </details>
            </div>
          </div>
        ),
      },
    ],
    []
  );

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const q = searchQuery.toLowerCase();
    return chapters.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q)
    );
  }, [chapters, searchQuery]);

  const activeChapter = useMemo(() => {
    return chapters.find((c) => c.id === activeChapterId) || chapters[0];
  }, [chapters, activeChapterId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* HERO BANNER WITH SEARCH */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: 12,
          padding: '28px 32px',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                backgroundColor: 'rgba(255,255,255,0.15)',
                padding: '3px 10px',
                borderRadius: 20,
                color: '#93c5fd',
              }}
            >
              Documentazione Ufficiale
            </span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>V5 · RAG Locale bge-m3 & Ricerca Ibrida BM25</span>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            Guida & Manuale Utente LIMEN Vault V5
          </h2>
          <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 20px 0' }}>
            Tutte le procedure operative, la configurazione del RAG locale a rete zero, la ricerca ibrida BM25, i workflow di lavoro e le soluzioni ai problemi tecnici.
          </p>

          {/* SEARCH BAR */}
          <div style={{ position: 'relative', maxWidth: 520 }}>
            <Search
              size={18}
              color="#94a3b8"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca nella guida (es. RAG Locale, bge-m3, BM25, Modalità degradata, Obsidian)..."
              style={{
                width: '100%',
                padding: '12px 16px 12px 42px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                fontSize: 13,
                outline: 'none',
                backdropFilter: 'blur(8px)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* QUICK LAUNCH CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          {
            id: 'rag-locale',
            title: 'RAG 100% Locale',
            desc: 'bge-m3, zero rete e calcolo locale',
            icon: <Sparkles size={20} color="#16a34a" />,
            bg: '#f0fdf4',
            border: '#bbf7d0',
          },
          {
            id: 'ricerca-ibrida',
            title: 'Ricerca Ibrida',
            desc: 'BM25, vettoriale e modalità degradata',
            icon: <Search size={20} color="#0284c7" />,
            bg: '#f0f9ff',
            border: '#bae6fd',
          },
          {
            id: 'workflows',
            title: 'Workflow Guidati',
            desc: 'Procedure W1-W4 passo-passo',
            icon: <Compass size={20} color="#7c3aed" />,
            bg: '#faf5ff',
            border: '#e9d5ff',
          },
          {
            id: 'problemi',
            title: 'Risoluzione Problemi',
            desc: 'Guida guasti, banner e log servizio',
            icon: <AlertCircle size={20} color="#d97706" />,
            bg: '#fffbeb',
            border: '#fde68a',
          },
        ].map((card) => (
          <div
            key={card.id}
            onClick={() => {
              setActiveChapterId(card.id);
              setSearchQuery('');
            }}
            style={{
              padding: '16px',
              backgroundColor: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              {card.icon}
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{card.title}</div>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{card.desc}</div>
          </div>
        ))}
      </div>

      {/* TWO COLUMN CONTENT VIEW */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* LEFT COLUMN: CHAPTERS TABLE OF CONTENTS */}
        <div
          className="limen-card"
          style={{
            padding: 12,
            position: 'sticky',
            top: 20,
            maxHeight: 'calc(100vh - 240px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', padding: '6px 12px 10px' }}>
            Indice della Guida ({filteredChapters.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredChapters.map((ch) => {
              const active = ch.id === activeChapter.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChapterId(ch.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: active ? '#0f172a' : 'transparent',
                    color: active ? '#ffffff' : '#334155',
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                    <span style={{ color: active ? '#93c5fd' : '#64748b' }}>{ch.icon}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ch.title}
                    </span>
                  </div>
                  {ch.badge && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 4,
                        backgroundColor: active ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                        color: active ? '#ffffff' : '#64748b',
                      }}
                    >
                      {ch.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {onOpenObsidian && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={onOpenObsidian}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ExternalLink size={14} />
                <span>Apri Obsidian</span>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: RICH CHAPTER CONTENT */}
        <div className="limen-card" style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ color: '#0284c7' }}>{activeChapter.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
              {activeChapter.badge || 'Capitolo'}
            </span>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>
            {activeChapter.title}
          </h2>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 24px 0' }}>
            {activeChapter.summary}
          </p>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0 0 24px 0' }} />

          {/* CHAPTER BODY */}
          <div style={{ fontSize: 14, lineHeight: 1.7, color: '#1e293b' }}>
            {activeChapter.content}
          </div>
        </div>
      </div>
    </div>
  );
}
