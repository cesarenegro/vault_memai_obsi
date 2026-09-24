export function isWindowsOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform ? navigator.platform.toLowerCase() : '';
  return platform.includes('win') || ua.includes('windows');
}

export function normalizeVaultPath(path: string): string {
  if (!path) return path;
  if (isWindowsOS()) {
    return path.replace(/\//g, '\\');
  }
  return path.replace(/\\/g, '/');
}

export function getPlatformTerms() {
  const isWin = isWindowsOS();
  return {
    isWin,
    osName: isWin ? 'Windows' : 'macOS',
    deviceTerm: isWin ? 'questo computer' : 'Mac',
    onDeviceTerm: isWin ? 'su questo computer' : 'sul Mac',
    fromDeviceTerm: isWin ? 'da questo computer' : 'dal Mac',
    fileManager: isWin ? 'Esplora file' : 'Finder',
    keychainTerm: isWin ? 'Gestore credenziali' : 'Portachiavi',
    modelsPath: isWin ? 'C:\\Users\\<utente>\\LIMEN Vault\\models\\' : '~/Library/Application Support/LIMEN Vault/models/',
    modelsLogPath: isWin ? 'C:\\Users\\<utente>\\LIMEN Vault\\models\\llama-server.log' : '~/Library/Application Support/LIMEN Vault/models/llama-server.log',
    gpuTerm: isWin ? 'Vulkan / GPU su Windows' : 'GPU Metal su Apple Silicon (misurato con bge-m3 su M2)',
    extractorTerm: isWin ? 'Estrattore nativo per testi e PDF' : 'Estrattore nativo Swift sul Mac',
    ocrSupported: !isWin,
    ocrDescription: isWin
      ? 'Estrattore nativo per testi e PDF. Nota: l’OCR nativo per scansioni/immagini non è disponibile su Windows.'
      : 'Estrattore nativo con OCR integrato tramite framework Vision di Apple macOS.',
  };
}
