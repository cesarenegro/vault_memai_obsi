export function isWindowsOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform ? navigator.platform.toLowerCase() : '';
  return platform.includes('win') || ua.includes('windows');
}

export function getPlatformTerms() {
  const isWin = isWindowsOS();
  return {
    isWin,
    osName: isWin ? 'Windows' : 'macOS',
    deviceTerm: isWin ? 'computer' : 'Mac',
    fileManager: isWin ? 'Esplora risorse' : 'Finder',
    keychainTerm: isWin ? 'Gestore credenziali' : 'Portachiavi',
    gpuTerm: isWin ? 'Vulkan / GPU su Windows' : 'GPU Metal su Apple Silicon (misurato con bge-m3 su M2)',
    ocrSupported: !isWin,
    ocrDescription: isWin
      ? 'Estrattore nativo per testi e PDF. Nota: l’OCR nativo per scansioni/immagini non è disponibile su Windows.'
      : 'Estrattore nativo con OCR integrato tramite framework Vision di Apple macOS.',
  };
}
