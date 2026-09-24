import React from 'react';
import { getPlatformTerms } from './platform';

// Labels are presentation only: persisted metadata and IPC values stay unchanged.
const labels: Record<string, string> = {
  clients:'Clienti', client:'Cliente', projects:'Progetti', project:'Progetto',
  brands:'Marchi', brand:'Marchio', positioning:'Posizionamento', packaging:'Confezionamento',
  methods:'Metodi', method:'Metodo', case_studies:'Casi studio', case_study:'Caso studio',
  research:'Ricerca di mercato', competitors:'Concorrenti', competitor:'Concorrente',
  approved_outputs:'Contenuti approvati', approved_output:'Contenuto approvato',
  proposal:'Proposta', ai_output:'Risposta AI', output:'Risposta AI',
  private:'Privata', approved:'Approvata', draft:'Bozza', review:'In revisione', archived:'Archiviata',
  pending:'Da revisionare', rejected:'Rifiutata', unspecified:'Non specificato',
  READY:'Pronto', NOT_CONFIGURED:'Non configurato', OFFLINE:'Non connesso',
  DISABLED:'Disattivato', VERIFYING:'Verifica in corso', AUTH_REQUIRED:'Autenticazione richiesta', TRANSFERRING:'Trasferimento in corso', FAILED:'Non riuscito', CONFLICT:'Conflitto',
  CONNECTING:'Collegamento in corso', EXPIRED:'Scaduto', REVOKED:'Revocato',
  COMPILED:'Compilata', CHANGED:'Modificata', NEW:'Nuova', UNSUPPORTED:'Non supportata',
  ERROR:'Errore', UNCOMPILED:'Da compilare', UNCHANGED:'Invariata',
  compiled:'Compilata', changed:'Modificata', unsupported:'Non supportata',
  ai:'Intelligenza artificiale', compiler:'Compilazione delle fonti',
};
export function labelIt(value: string | null | undefined): string {
  return value ? labels[value] ?? value : 'Non specificato';
}

function getMessages(): Record<string, string> {
  const { keychainTerm } = getPlatformTerms();
  return {
    'Configure API key in Settings':'Configura la chiave API nelle Impostazioni.',
    'Select an API model':'Indica un modello API disponibile nel tuo account.',
    'Invalid API key format':'Il formato della chiave API non è valido.',
    'Keychain access denied or unavailable':`Accesso al ${keychainTerm} negato o non disponibile.`,
    'Unable to remove Keychain entry':`Impossibile rimuovere la chiave dal ${keychainTerm}.`,
    'Invalid tunnel or organization ID':'ID del tunnel o dell’organizzazione non valido.',
    'Configure a tunnel runtime key in Keychain':'Salva la chiave del tunnel nelle Impostazioni.',
    'Tunnel Keychain access denied':`Accesso alla chiave del tunnel nel ${keychainTerm} negato.`,
    'Vault validation failed':'Il Vault non ha superato la validazione.',
    'Vault path is not a directory':'Il percorso del Vault non indica una cartella.',
    'Preview expired; select sources again':'Anteprima scaduta. Seleziona nuovamente le fonti.',
    'Preview expired or no eligible sources':'Anteprima scaduta o nessuna fonte utilizzabile. Aggiorna l’indice e controlla le note approvate.',
    'An AI request is already running':'È già in corso una richiesta AI.',
    'Source changed since preview':'Una fonte è cambiata dopo l’anteprima. Prepara una nuova anteprima.',
    'Request cancelled':'Richiesta annullata.',
    'Document access denied':'Accesso al documento negato.',
    'Knowledge document changed during read':'La nota è cambiata durante la lettura. Aggiorna la schermata.',
    'Category preview exceeds 8 MiB':'L’anteprima della categoria supera il limite di 8 MiB.',
  };
}

export function MessageIt({value}: {value: unknown}) {
  const raw = value instanceof Error ? value.message : String(value ?? '');
  const key = raw.replace(/^Error: /, '');
  const messages = getMessages();
  if (messages[key]) return <>{messages[key]}</>;
  // Messages authored in Italian are displayed as-is. Unknown provider/OS
  // diagnostics remain available verbatim without pretending to translate them.
  if (/[àèéìòù’]|\b(Errore|Impossibile|Nessun|Nessuna|non|Annullamento|Collegamento|Verifica|Pubblicazione|attendo|Salvata|Bozza)\b/i.test(key)) return <>{key}</>;
  return <><span>Operazione non completata. Consulta il dettaglio tecnico per identificare la causa.</span><span style={{display:'block'}}>Dettaglio tecnico originale: <code style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{raw}</code></span></>;
}
