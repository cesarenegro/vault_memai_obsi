// Utility functions for formatting and cleaning source titles, categories, and locators.

export function cleanTitle(title: string, relativePath: string): string {
  let base = title && !title.startsWith('doc_') && !title.endsWith('.md')
    ? title
    : (relativePath ? relativePath.split('/').pop() || relativePath : '');
  if (!base) return '';
  base = base.replace(/\.md$/i, '');
  // Rimuovi prefissi tecnici con _ (es. doc_..._ o a-f0-9_)
  base = base.replace(/^[a-f0-9_-]{8,32}_/i, '');
  // Rimuovi prefissi esadecimali a 16 caratteri seguiti da - (es. 32f2a4081d13410e-BNXT CRM.md)
  base = base.replace(/^[a-f0-9]{16}-/i, '');
  return base.trim();
}

export function formatSourceCategory(category?: string, relativePath?: string): string {
  let c = category ? category.toLowerCase().trim() : '';
  if (!c && relativePath) {
    const p = relativePath.replace(/\\/g, '/');
    const first = p.split('/')[0] || '';
    if (first.startsWith('20_RAW_SOURCES')) c = 'raw_source';
    else if (first.startsWith('01_CLIENTS')) c = 'clients';
    else if (first.startsWith('02_PROJECTS')) c = 'projects';
    else if (first.startsWith('03_BRANDS')) c = 'brands';
    else if (first.startsWith('04_POSITIONING')) c = 'positioning';
    else if (first.startsWith('05_PACKAGING')) c = 'packaging';
    else if (first.startsWith('06_METHODS')) c = 'methods';
    else if (first.startsWith('07_CASE_STUDIES')) c = 'case_studies';
    else if (first.startsWith('08_MARKET_RESEARCH')) c = 'research';
    else if (first.startsWith('09_COMPETITORS')) c = 'competitors';
    else if (first.startsWith('10_APPROVED_OUTPUTS')) c = 'approved_outputs';
  }

  switch (c) {
    case 'raw_source':
    case 'raw_sources':
      return 'Documento caricato';
    case 'clients':
    case '01_clients':
      return 'Clienti';
    case 'projects':
    case '02_projects':
      return 'Progetti';
    case 'brands':
    case '03_brands':
      return 'Brand';
    case 'positioning':
    case '04_positioning':
      return 'Posizionamento';
    case 'packaging':
    case 'packaging_knowledge':
    case '05_packaging_knowledge':
      return 'Packaging';
    case 'methods':
    case '06_methods':
      return 'Metodi';
    case 'case_studies':
    case '07_case_studies':
      return 'Casi studio';
    case 'research':
    case 'market_research':
    case '08_market_research':
      return 'Ricerche';
    case 'competitors':
    case '09_competitors':
      return 'Concorrenti';
    case 'approved_outputs':
    case '10_approved_outputs':
      return 'Output approvati';
    case 'notes':
      return 'Nota';
    case 'proposal':
    case 'proposals':
      return 'Proposta';
    default:
      return c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Documento';
  }
}

export function formatLocator(locator?: string): string {
  if (!locator) return '';
  let loc = locator.trim();
  // Se il localizzatore ripete la parola (es. "Paragrafi 1-13, Paragrafi 52-68" -> "Paragrafi 1-13, 52-68")
  if (loc.startsWith('Paragrafi ')) {
    loc = 'Paragrafi ' + loc.slice('Paragrafi '.length).replace(/,?\s*Paragrafi\s+/gi, ', ');
  } else if (loc.startsWith('Paragrafo ')) {
    loc = loc.replace(/,?\s*Paragrafo\s+/gi, ', ');
  } else if (loc.startsWith('Pagine ')) {
    loc = 'Pagine ' + loc.slice('Pagine '.length).replace(/,?\s*Pagine\s+/gi, ', ');
  } else if (loc.startsWith('Pagina ')) {
    loc = loc.replace(/,?\s*Pagina\s+/gi, ', ');
  }
  return loc;
}

export function formatSourceLabel(title: string, relativePath: string, category?: string, locator?: string): string {
  const clean = cleanTitle(title, relativePath);
  const cat = formatSourceCategory(category, relativePath);
  const loc = formatLocator(locator);
  const parts = [clean || relativePath, cat];
  if (loc) {
    parts.push(loc);
  }
  return parts.join(' · ');
}
