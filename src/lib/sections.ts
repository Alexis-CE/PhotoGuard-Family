export type SectionId = 'protect' | 'emblem' | 'presets' | 'batch' | 'verify';

export interface SectionDef {
  id: SectionId;
  label: string;
  ready: boolean;
  /** Contenido interno de un <svg viewBox="0 0 24 24"> (trazos, sin relleno). Texto estático propio. */
  icon: string;
  summary: string;
  /** Lo planeado para la sección (solo se muestra si aún no está operativa). */
  planned: string[];
}

export const SECTIONS: readonly SectionDef[] = [
  {
    id: 'protect',
    label: 'Proteger',
    ready: true,
    icon: '<path d="M12 3l8 3v6c0 4.4-3.1 8-8 9-4.9-1-8-4.6-8-9V6l8-3z"/>',
    summary: 'Importa una foto, compón la marca de agua y exporta.',
    planned: []
  },
  {
    id: 'emblem',
    label: 'Emblem Studio',
    ready: false,
    icon: '<circle cx="12" cy="9" r="5"/><path d="M4 21h16M8 14l-2 7M16 14l2 7"/>',
    summary: 'Importar tus propias imágenes como emblema.',
    planned: [
      'Importar PNG, JPG o WEBP como emblema.',
      'Quitar el fondo en el dispositivo para obtener un PNG con transparencia real.',
      'Ajustar tamaño, posición y opacidad del emblema.'
    ]
  },
  {
    id: 'presets',
    label: 'Presets',
    ready: false,
    icon: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    summary: 'Guardar y reutilizar tus configuraciones.',
    planned: [
      'Guardar la configuración actual con nombre (IndexedDB).',
      'Preset predeterminado y presets ilimitados (según el almacenamiento disponible).',
      'Exportar e importar presets entre dispositivos (ZIP + JSON).'
    ]
  },
  {
    id: 'batch',
    label: 'Por lotes',
    ready: false,
    icon: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12.5l9 5 9-5M3 17l9 5 9-5"/>',
    summary: 'Aplicar un preset a muchas fotos.',
    planned: [
      'Selección múltiple, barra de progreso y cancelación.',
      'Errores por archivo sin detener el lote.',
      'Exportación individual o en un ZIP, cuidando la memoria del teléfono.'
    ]
  },
  {
    id: 'verify',
    label: 'Verify',
    ready: false,
    icon: '<circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/>',
    summary: 'Comprobar evidencias sobre una foto.',
    planned: [
      'Hash SHA-256 y hash perceptual.',
      'Comparación visual entre dos fotos.',
      'Resultados con niveles de evidencia, sin afirmar que una foto es robada o legítima.'
    ]
  }
];
