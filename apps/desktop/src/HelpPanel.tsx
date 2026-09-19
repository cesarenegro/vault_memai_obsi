import React, { useState, useMemo } from 'react';
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
  const [activeChapterId, setActiveChapterId] = useState('fonti');
  const [searchQuery, setSearchQuery] = useState('');

  const chapters: HelpSection[] = useMemo(
    () => [
      {
        id: 'concetti',
        title: '1. I concetti essenziali',
        badge: 'Base',
        icon: <Compass size={16} />,
        summary: 'Che cos’è un Vault, le 4 azioni da distinguere, ciclo di vita e privacy locale.',
        content: (
          <div>
            <h3>Un Vault è una cartella di lavoro sul tuo Mac</h3>
            <p>
              Il <strong>Vault</strong> contiene note Markdown, documenti originali, bozze e informazioni di sistema. Rimane salvato sul tuo Mac, indipendente dall’applicazione.
            </p>
            <ul>
              <li><strong>Obsidian</strong> serve per scrivere e modificare le note liberamente.</li>
              <li><strong>LIMEN Vault</strong> serve per consultarle, indicizzarle, generare automaticamente note e wiki dai documenti grezzi, fare domande all’AI con anteprima locale, revisionare proposte e gestire copie verificate e pubblicazioni.</li>
            </ul>

            <h4>Quattro azioni da non confondere</h4>
            <div style={{ overflowX: 'auto', margin: '14px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '8px 12px' }}>Azione</th>
                    <th style={{ padding: '8px 12px' }}>Cosa ottieni</th>
                    <th style={{ padding: '8px 12px' }}>Dove trovi il risultato</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Salvare una risposta AI</td>
                    <td style={{ padding: '8px 12px' }}>Una bozza locale da controllare</td>
                    <td style={{ padding: '8px 12px' }}><strong>Risposte AI</strong>, file in <code>80_AI_OUTPUTS</code></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Approvare una proposta</td>
                    <td style={{ padding: '8px 12px' }}>Una nota approvata nella categoria scelta</td>
                    <td style={{ padding: '8px 12px' }}><strong>Conoscenza</strong>, cartelle da <code>01</code> a <code>10</code></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Pubblicare conoscenza</td>
                    <td style={{ padding: '8px 12px' }}>Una selezione di note accessibile al CRM</td>
                    <td style={{ padding: '8px 12px' }}><strong>Trasferimenti</strong>, pubblicazione R2 corrente</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Creare una copia</td>
                    <td style={{ padding: '8px 12px' }}>Una versione protetta per recuperare il lavoro</td>
                    <td style={{ padding: '8px 12px' }}><strong>Copie locali</strong> (o copia privata cloud)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Callout type="warning" title="Regola fondamentale">
              Salvare una risposta non la approva. Approvare una nota non la pubblica automaticamente nel cloud o nel CRM. Una copia privata cloud non è visibile al CRM.
            </Callout>

            <h4>Quando il lavoro resta sul Mac</h4>
            <p>
              Consultare note, cercare parole nell’indice, compilare fonti in bozze, revisionare proposte e creare copie locali <strong>non richiede alcuna connessione di rete</strong> né invia dati all’esterno. L’automazione attivata invia il testo estratto a OpenAI per classificazione e wiki. Le domande AI e i trasferimenti cloud richiedono anch’essi la rete.
            </p>
          </div>
        ),
      },
      {
        id: 'primi-passi',
        title: '2. Primi passi',
        badge: 'Guida rapida',
        icon: <GraduationCap size={16} />,
        summary: 'Aprire o creare un Vault, collegare Obsidian, prime note e verifica copie.',
        content: (
          <div>
            <h3>Guida rapida in 4 passi</h3>

            <h4>Passo 1 — Apri o crea il Vault</h4>
            <ol>
              <li>Avvia <strong>LIMEN Vault</strong> sul Mac.</li>
              <li>Nella schermata di benvenuto, inserisci il percorso della cartella locale (es. <code>/Users/nome/Documents/VAULT</code>).</li>
              <li>Premi <strong>APRI VAULT ESISTENTE</strong> se possiedi già un Vault LIMEN valido, oppure <strong>CREA NUOVO VAULT</strong> se la cartella è vuota.</li>
            </ol>
            <p><strong>Risultato atteso:</strong> la finestra si apre sulla <strong>Panoramica</strong> con stato <strong>Pronto</strong>.</p>

            <h4>Passo 2 — Collega Obsidian</h4>
            <ol>
              <li>Premi il pulsante <strong>Apri in Obsidian</strong> in basso a sinistra.</li>
              <li>Se Obsidian non conosce ancora la cartella, scegli <em>Open folder as vault</em> e seleziona la cartella del Vault.</li>
              <li>Torna in LIMEN e premi di nuovo <em>Apri in Obsidian</em>.</li>
            </ol>

            <h4>Passo 3 — Configura e carica i documenti</h4>
            <ol>
              <li>In <strong>Impostazioni</strong> salva la chiave API. In <strong>Fonti</strong> indica il modello e premi <strong>ATTIVA AUTOMAZIONE</strong>.</li>
              <li>Premi <strong>CARICA DOCUMENTI</strong> e seleziona gli originali. LIMEN converte, classifica e salva note e wiki.</li>
              <li>Attendi l’esito in <strong>Avanzamento e documenti</strong>, poi consulta <strong>Conoscenza</strong> o <strong>Ricerca</strong>. L’indice delle elaborazioni viene aggiornato automaticamente.</li>
            </ol>

            <h4>Passo 4 — Salva la prima copia locale</h4>
            <p>
              Vai in <strong>Copie locali</strong>, scrivi una nota (es. <em>Configurazione iniziale</em>) e premi <strong>CREA COPIA LOCALE</strong>. Verifica che la card mostri lo stato <strong>Verificata (SHA-256)</strong>.
            </p>
          </div>
        ),
      },
      {
        id: 'routine',
        title: '3. La routine quotidiana',
        badge: 'Operativo',
        icon: <RotateCw size={16} />,
        summary: 'Cosa aggiornare dopo ogni modifica e come cercare con precisione.',
        content: (
          <div>
            <h3>Quale aggiornamento serve?</h3>
            <div style={{ overflowX: 'auto', margin: '14px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '8px 12px' }}>Cosa hai fatto</th>
                    <th style={{ padding: '8px 12px' }}>Azione consigliata</th>
                    <th style={{ padding: '8px 12px' }}>Serve aggiornare l’indice?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px' }}>Modificato o aggiunto una nota in Obsidian</td>
                    <td style={{ padding: '8px 12px' }}>Tasto <strong>Aggiorna</strong> in topbar, o in <strong>Conoscenza</strong></td>
                    <td style={{ padding: '8px 12px' }}>Sì, in <strong>Ricerca</strong></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px' }}>Aggiunto un file in <code>20_RAW_SOURCES</code></td>
                    <td style={{ padding: '8px 12px' }}>In <strong>Fonti</strong> controlla <strong>Avanzamento e documenti</strong></td>
                    <td style={{ padding: '8px 12px' }}>Automatico a fine elaborazione, se attivato</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px' }}>Approvato una proposta in Proposte</td>
                    <td style={{ padding: '8px 12px' }}>La nota è creata; controlla in <strong>Conoscenza</strong></td>
                    <td style={{ padding: '8px 12px' }}>Sì, per renderla ricercabile</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px' }}>Salvato una risposta AI da Chiedi al Vault</td>
                    <td style={{ padding: '8px 12px' }}>Vai in <strong>Risposte AI</strong> e controlla la bozza</td>
                    <td style={{ padding: '8px 12px' }}>Sì, se vuoi cercarla</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Callout type="tip" title="Tasto rapido">
              Il nuovo pulsante <strong>Aggiorna</strong> al centro della barra superiore ricarica l’intero stato del Vault, il numero di pagine, le fonti e le proposte con un solo clic.
            </Callout>
          </div>
        ),
      },
      {
        id: 'note',
        title: '4. Note e cartelle',
        badge: 'Struttura',
        icon: <FolderTree size={16} />,
        summary: 'Mappatura delle cartelle da 01 a 10, RAW, Frontmatter e proprietà obbligatorie.',
        content: (
          <div>
            <h3>Dove mettere ogni contenuto</h3>
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

            <h4>Esempio di nota con Frontmatter corretto</h4>
            <CodeBlock
              language="markdown"
              code={`---
schema_version: 1
id: cliente-acme
title: "Cliente Acme SpA"
type: client
client: cliente-acme
status: approved
created_at: "2026-09-16T10:00:00Z"
updated_at: "2026-09-16T10:00:00Z"
tags: [pasta, packaging, bio]
---

# Cliente Acme SpA

Produttore italiano di prodotti da forno.
Richiede soluzioni di packaging compostabile.`}
            />

            <Callout type="info" title="Regola importante">
              I nomi delle proprietà tecniche (<code>status</code>, <code>client</code>, <code>type</code>) e i relativi valori (<code>approved</code>, <code>draft</code>) non vanno mai tradotti nei file Markdown: l’interfaccia grafica italiana li traduce automaticamente a video.
            </Callout>
          </div>
        ),
      },
      {
        id: 'fonti',
        title: '5. Caricamento e conoscenza automatica',
        badge: 'RAW',
        icon: <FolderArchive size={16} />,
        summary: 'Carica file grezzi: conversione, organizzazione, ricerca e wiki automatiche.',
        content: (
          <div>
            <h3>Flusso automatico</h3>
            <p>Configura una volta la chiave API e il modello, poi attiva l’automazione nella sezione Fonti. Da quel momento basta caricare i documenti con CARICA DOCUMENTI oppure copiarli in RAW: LIMEN converte in Markdown, normalizza, classifica, salva nelle cartelle tematiche e aggiorna ricerca e wiki.</p>
            <p>PDF, scansioni, DOC/DOCX, ODT/RTF, PPTX, Excel/ODS, immagini e testi vengono elaborati sul Mac. L’AI riceve testo per classificazione e sintesi. Gli originali rimangono intatti. Le note automatiche sono consultabili senza approvazione manuale e restano distinguibili dalle note approvate da una persona.</p>
            <p>L’elaborazione prosegue mentre il Vault è aperto e riprende alla riapertura. La lista mostra le eccezioni: file non leggibili, protetti, limiti o connessione AI assente. Non serve convertire né dividere manualmente i documenti entro i limiti indicati.</p>
            <h4>Dove trovi note e wiki</h4>
            <ul>
              <li><code>20_RAW_SOURCES</code>: originali conservati integri.</li>
              <li>Cartelle <code>01_CLIENTS</code>–<code>09_COMPETITORS</code>: note <code>auto-source-</code> e wiki <code>auto-wiki-</code>, con titoli leggibili e fonti collegate.</li>
              <li>Cliente e progetto sono proprietà delle note; le wiki sono raggruppate per questi riferimenti. Non vengono create sottocartelle per ciascuno.</li>
              <li><code>00_SYSTEM</code>: registro delle elaborazioni e indice.</li>
            </ul>
            <p>I documenti lunghi vengono suddivisi in parti con una nota indice. Se cambia o scompare una fonte, i risultati precedenti vengono esclusi dalle risposte AI. Le modifiche manuali alle note generate vengono preservate e segnalate.</p>
            <h4>Configurazione e limiti</h4>
            <p>Salva la chiave in <strong>Impostazioni</strong>; in <strong>Fonti</strong> indica un modello API disponibile e premi <strong>ATTIVA AUTOMAZIONE</strong>. Sono previste chiamate OpenAI a consumo. Il controllo avviene ogni 15 secondi mentre l’app è aperta. <strong>METTI IN PAUSA</strong> interrompe i cicli successivi.</p>
            <p>Massimo 32 MB per file; PDF fino a 500 pagine; OCR fino a 180 secondi; testo estratto Office/fogli/PDF fino a 16 MB. File protetti, corrotti, formati sconosciuti e presentazioni legacy .ppt sono segnalati. L’OCR e le sintesi AI possono contenere errori.</p>
            <p>Dopo tre tentativi per revisione la coda segnala l’eccezione. Risolvi la causa e usa <strong>RIPROVA LE ECCEZIONI RISOLTE</strong>. Per errori di credenziale o modello correggi la configurazione e riattiva l’automazione.</p>
            <Callout type="info" title="Automatico e approvazione umana">
              Le note automatiche restano <code>status: review</code> e sono consultabili da AI e MCP quando aggiornate. La pubblicazione nel CRM richiede ancora una selezione esplicita di note approvate.
            </Callout>
            <h4>Compilazione manuale facoltativa</h4>

            <h3>Come funzionano le fonti RAW</h3>
            <p>
              La cartella <code>20_RAW_SOURCES/</code> è il punto di ingresso per qualsiasi materiale grezzo: appunti, brief cliente, trascrizioni di riunioni, articoli esterni in formato <code>.md</code>, <code>.txt</code> o <code>.html</code>.
            </p>
            <ul>
              <li>Le fonti originali rimangono <strong>immutabili e in sola lettura</strong>.</li>
              <li>I file RAW sono esclusi dal contesto diretto di <em>Chiedi al Vault</em>; entrano invece le note estratte e le wiki correnti. Questo non garantisce la correttezza delle sintesi AI.</li>
              <li>Premendo <strong>COMPILA TUTTE LE FONTI</strong> (oppure il pulsante singolo su un file), il compilatore genera una proposta in <code>90_PROPOSALS/</code> con <code>status: draft</code>.</li>
            </ul>

            <Callout type="tip" title="Accesso rapido">
              Puoi raggiungere la gestione delle fonti direttamente dalla scheda principale <strong>Accesso rapido → Vault / RAW (20_RAW_SOURCES)</strong> in Panoramica.
            </Callout>
          </div>
        ),
      },
      {
        id: 'ai',
        title: '6. Chiedi al Vault (AI)',
        badge: 'AI & OpenAI',
        icon: <MessageSquare size={16} />,
        summary: 'Preparare il contesto locale, anteprima fonti verificata e invio sicuro a OpenAI.',
        content: (
          <div>
            <h3>Domande governate con intelligenza artificiale</h3>
            <p>
              In <strong>Chiedi al Vault</strong> puoi interrogare la tua conoscenza locale tramite OpenAI, mantenendo il pieno controllo di cosa viene inviato.
            </p>
            <ol>
              <li>Scrivi la domanda nel riquadro.</li>
              <li>Premi <strong>ANTEPRIMA FONTI</strong>: LIMEN seleziona note approvate e note/wiki automatiche correnti pertinenti.</li>
              <li>Controlla l’anteprima: vedrai l’elenco esatto delle fonti, i byte di contesto e gli hash SHA-256.</li>
              <li>Se sei soddisfatto, premi <strong>INVIA A OPENAI LE FONTI MOSTRATE</strong>.</li>
              <li>Puoi salvare la risposta come bozza in <code>80_AI_OUTPUTS/</code> per sottoporla a revisione.</li>
            </ol>
            <Callout type="info" title="Invio delle fonti">
              Per questa domanda vengono inviate le fonti mostrate nell’anteprima. L’automazione documenti è distinta: la sua attivazione autorizza le chiamate per classificazione e wiki senza conferme per ogni file.
            </Callout>
          </div>
        ),
      },
      {
        id: 'proposte',
        title: '7. Revisione e approvazione',
        badge: 'Governance',
        icon: <FileCheck size={16} />,
        summary: 'Come approvare bozze, proporre nuove revisioni o rifiutare le proposte.',
        content: (
          <div>
            <h3>Flusso governato delle proposte</h3>
            <p>
              Nella sezione <strong>Proposte</strong> puoi revisionare le bozze generate dal compilatore RAW o salvate dalle risposte AI.
            </p>
            <div style={{ padding: 16, backgroundColor: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8, margin: '14px 0' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#14532d' }}>Come approvare una proposta:</h4>
              <ol style={{ margin: 0, paddingLeft: 20, color: '#166534', fontSize: 13, lineHeight: 1.6 }}>
                <li>Apri la sezione <strong>Proposte</strong> dalla sidebar.</li>
                <li>Nel riquadro verde in alto, controlla la <strong>Nuova destinazione (.md)</strong>: LIMEN la precompila automaticamente con la cartella corretta (es. <code>01_CLIENTS/nome-nota.md</code>).</li>
                <li>Attiva la casella di controllo: <em>“Ho verificato questa revisione e la destinazione indicata”</em>.</li>
                <li>Premi il pulsante verde <strong>APPROVA REVISIONE MOSTRATA</strong>.</li>
              </ol>
            </div>
            <p>
              La nota approvata viene inserita istantaneamente nella cartella del Vault con <code>status: approved</code>, preservando la proposta originale per fini di audit.
            </p>
          </div>
        ),
      },
      {
        id: 'copie',
        title: '8. Copie locali e integrità',
        badge: 'Sicurezza',
        icon: <History size={16} />,
        summary: 'Creare snapshot crittografici, manifesto SHA-256 e ripristino sicuro.',
        content: (
          <div>
            <h3>Integrità crittografica SHA-256</h3>
            <p>
              La sezione <strong>Copie locali</strong> monitora la corrispondenza dei file rispetto al manifesto delle impronte crittografiche SHA-256.
            </p>
            <ul>
              <li><strong>Verificata:</strong> tutti i file corrispondono esattamente all’ultima copia certificata.</li>
              <li><strong>Differenze rilevate:</strong> indica i file modificati, mancanti o aggiunti rispetto all’ultimo manifesto.</li>
              <li><strong>Crea copia locale:</strong> genera un nuovo snapshot immutabile in <code>00_SYSTEM/SNAPSHOTS/</code>.</li>
            </ul>
            <Callout type="tip" title="Backup prima di modifiche importanti">
              Crea sempre una copia locale prima di sessioni intensive di scrittura o prima di trasferimenti cloud.
            </Callout>
          </div>
        ),
      },
      {
        id: 'trasferimenti',
        title: '9. Trasferimenti e Cloud R2',
        badge: 'Cloud R2',
        icon: <Cloud size={16} />,
        summary: 'Sincronizzazione R2, pubblicazione verso il CRM e canale privato.',
        content: (
          <div>
            <h3>Sincronizzazione Cloudflare R2</h3>
            <p>
              La sezione <strong>Trasferimenti</strong> gestisce la comunicazione con l’archivio cloud configurato.
            </p>
            <ul>
              <li><strong>Canale Pubblicato (CRM):</strong> include esclusivamente le note approvate delle cartelle da 01 a 10 selezionate esplicitamente per la consultazione nel CRM.</li>
              <li><strong>Canale Privato:</strong> copia di sicurezza del Vault (esclusi file di sistema temporanei) protetta da token di accesso tenant/vault dedicati.</li>
            </ul>
          </div>
        ),
      },
      {
        id: 'problemi',
        title: '13. Problemi e soluzioni',
        badge: 'FAQ',
        icon: <AlertCircle size={16} />,
        summary: 'Guida alla risoluzione dei dubbi e degli errori più frequenti.',
        content: (
          <div>
            <h3>Domande frequenti e soluzioni</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <details style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
                <summary style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  Obsidian non apre automaticamente il Vault
                </summary>
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  Alla prima esecuzione Obsidian deve registrare la cartella. In Obsidian seleziona <em>Open folder as vault</em> e scegli il tuo percorso Vault. Al secondo clic su <strong>Apri in Obsidian</strong> da LIMEN, il Vault si aprirà istantaneamente.
                </div>
              </details>

              <details style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
                <summary style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  Una nota appena creata non compare nella Ricerca
                </summary>
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  L’indice di ricerca non si aggiorna in tempo reale per risparmiare risorse e batteria. Vai nella scheda <strong>Ricerca</strong> e premi <strong>AGGIORNA INDICE DI RICERCA</strong>, oppure premi il pulsante <strong>Aggiorna</strong> al centro della barra superiore.
                </div>
              </details>

              <details style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
                <summary style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  Il pulsante di approvazione proposta è disabilitato
                </summary>
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  Per ragioni di sicurezza e audit, l’approvazione richiede: 1) un percorso file valido in <em>Nuova destinazione (.md)</em>, e 2) la spunta attiva sulla casella <em>“Ho verificato questa revisione e la destinazione indicata”</em>.
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
            <span style={{ fontSize: 12, color: '#94a3b8' }}>v3 · Guida aggiornata</span>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            Guida & Manuale Utente LIMEN Vault v3
          </h2>
          <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 20px 0' }}>
            Tutte le procedure operative, la struttura delle cartelle, le regole di approvazione e le soluzioni ai problemi tecnici.
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
              placeholder="Cerca nella guida (es. RAW, Obsidian, Frontmatter, Approva)..."
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
            id: 'primi-passi',
            title: 'Primi Passi',
            desc: 'Creazione e collegamento Obsidian',
            icon: <GraduationCap size={20} color="#0284c7" />,
            bg: '#f0f9ff',
            border: '#bae6fd',
          },
          {
            id: 'note',
            title: 'Note & Cartelle',
            desc: 'Frontmatter da 01 a 10',
            icon: <FolderTree size={20} color="#16a34a" />,
            bg: '#f0fdf4',
            border: '#bbf7d0',
          },
          {
            id: 'fonti',
            title: 'Vault RAW',
            desc: 'Documenti, note e wiki automatiche',
            icon: <FolderArchive size={20} color="#d97706" />,
            bg: '#fffbeb',
            border: '#fde68a',
          },
          {
            id: 'proposte',
            title: 'Approvazione',
            desc: 'Come approvare bozze e revisioni',
            icon: <FileCheck size={20} color="#7c3aed" />,
            bg: '#faf5ff',
            border: '#e9d5ff',
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
