import { registerSW } from 'virtual:pwa-register';
import { readPlatform, type PlatformInfo } from '$lib/utils/platform';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'photoguard:install-hint-dismissed';
const UPDATE_CHECK_MS = 60 * 60 * 1000;

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Estado PWA: instalación (solo móvil), conexión y actualizaciones.
 * No guarda ni toca fotos; solo una marca local para no repetir la ayuda de instalación.
 */
class PwaState {
  platform = $state<PlatformInfo>({ isIOS: false, isAndroid: false, isMobile: false, isStandalone: false });
  online = $state(true);

  /** Hay un Service Worker nuevo esperando */
  needRefresh = $state(false);
  /** El usuario pospuso el aviso (sigue disponible desde el encabezado) */
  snoozed = $state(false);
  applying = $state(false);
  /** Primera vez que la app queda lista para usarse sin conexión */
  offlineReady = $state(false);

  installDismissed = $state(false);
  installEvent = $state.raw<BeforeInstallPromptEvent | null>(null);

  #updateSW: ((reload?: boolean) => Promise<void>) | null = null;

  /** Android/Chrome: el navegador ofreció instalar y estamos en un móvil. */
  get canPromptInstall(): boolean {
    return this.platform.isAndroid && !this.platform.isStandalone && this.installEvent !== null && !this.installDismissed;
  }

  /** iOS: no hay API; se muestran instrucciones de «Añadir a pantalla de inicio». */
  get showIosHint(): boolean {
    return this.platform.isIOS && !this.platform.isStandalone && !this.installDismissed;
  }

  init(): void {
    this.platform = readPlatform();
    this.online = navigator.onLine;
    this.installDismissed = readDismissed();

    window.addEventListener('online', () => (this.online = true));
    window.addEventListener('offline', () => (this.online = false));

    window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
      this.platform = readPlatform();
    });

    // La promoción de instalación es solo para móviles. En escritorio no capturamos el evento:
    // el navegador puede ofrecer su propia opción, pero PhotoGuard no la promueve.
    window.addEventListener('beforeinstallprompt', (event) => {
      if (!this.platform.isMobile) return;
      event.preventDefault();
      this.installEvent = event as BeforeInstallPromptEvent;
    });
    window.addEventListener('appinstalled', () => {
      this.installEvent = null;
      this.platform = readPlatform();
    });

    this.#registerServiceWorker();
  }

  #registerServiceWorker(): void {
    // En desarrollo no hay SW (evita cachés fantasma mientras se programa).
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

    this.#updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        this.needRefresh = true;
        this.snoozed = false;
      },
      onOfflineReady: () => {
        this.offlineReady = true;
      },
      onRegisteredSW: (_url, registration) => {
        if (!registration) return;
        const check = () => {
          if (navigator.onLine) void registration.update().catch(() => {});
        };
        setInterval(check, UPDATE_CHECK_MS);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      },
      onRegisterError: (error) => console.error('No se pudo registrar el Service Worker', error)
    });
  }

  snooze(): void {
    this.snoozed = true;
  }

  reopenUpdate(): void {
    this.snoozed = false;
  }

  dismissOfflineReady(): void {
    this.offlineReady = false;
  }

  /**
   * Activa el SW nuevo y recarga. `busy` lo decide quien conoce el trabajo en curso:
   * nunca se actualiza mientras se procesa una foto.
   */
  async applyUpdate(busy: boolean): Promise<boolean> {
    if (busy || this.applying || !this.#updateSW) return false;
    this.applying = true;
    try {
      await this.#updateSW(true);
      return true;
    } catch (error) {
      console.error(error);
      this.applying = false;
      return false;
    }
  }

  async install(): Promise<void> {
    const event = this.installEvent;
    if (!event) return;
    this.installEvent = null; // el evento solo se puede usar una vez
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'dismissed') this.dismissInstallHint();
  }

  dismissInstallHint(): void {
    this.installDismissed = true;
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sin almacenamiento: la ayuda reaparecerá en la próxima visita */
    }
  }
}

export const pwa = new PwaState();
