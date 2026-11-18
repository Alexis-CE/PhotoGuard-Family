export interface PlatformInput {
  userAgent: string;
  maxTouchPoints: number;
  /** navigator.standalone (solo iOS) */
  navigatorStandalone?: boolean;
  /** matchMedia('(display-mode: standalone)').matches */
  displayModeStandalone: boolean;
}

export interface PlatformInfo {
  isIOS: boolean;
  isAndroid: boolean;
  /** Móvil/tableta: único caso en el que PhotoGuard muestra ayuda de instalación */
  isMobile: boolean;
  /** Ya abierta como app instalada */
  isStandalone: boolean;
}

/** Función pura (testeable). iPadOS 13+ se presenta como «Macintosh» con pantalla táctil. */
export function detectPlatform(input: PlatformInput): PlatformInfo {
  const ua = input.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && input.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  return {
    isIOS,
    isAndroid,
    isMobile: isIOS || isAndroid,
    isStandalone: input.displayModeStandalone || input.navigatorStandalone === true
  };
}

export function readPlatform(): PlatformInfo {
  const nav = navigator as Navigator & { standalone?: boolean };
  return detectPlatform({
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    navigatorStandalone: nav.standalone,
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches
  });
}
