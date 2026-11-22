<script lang="ts">
  import { presets } from '$lib/state/presets.svelte';
  import { workspace } from '$lib/state/workspace.svelte';
  import { findMissingFontIds, fontLabel } from '$lib/services/presetValidation';
  import { isFactoryPreset, PRESET_NAME_MAX, type PresetRecord } from '$lib/types/preset';
  import type { CompositionMode, TextStyle } from '$lib/types/watermark';

  const uid = $props.id();
  const modeLabels: Record<CompositionMode, string> = { pattern: 'Patrón', both: 'Híbrido', emblem: 'Emblema' };
  const dateFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

  let newName = $state('');
  let editingId = $state<string | null>(null);
  let editName = $state('');
  let replaceConfig = $state(false);
  let confirmingId = $state<string | null>(null);

  const userCount = $derived(presets.items.filter((p) => !isFactoryPreset(p)).length);
  const effectiveDefaultId = $derived(presets.defaultId ?? presets.items[0]?.id ?? null);

  function styleLabel(style: TextStyle): string {
    return `${fontLabel(style.fontId)}${style.bold ? ' negrita' : ''}`;
  }

  function describe(preset: PresetRecord): string {
    const { config } = preset;
    const styles: string[] = [];
    if (config.mode !== 'emblem') styles.push(styleLabel(config.pattern));
    if (config.mode !== 'pattern') styles.push(styleLabel(config.emblem));
    const unique = [...new Set(styles)].join(' · ');
    const format = config.export.format === 'jpeg' ? `JPEG ${config.export.quality}%` : 'PNG';
    return `${modeLabels[config.mode]} · ${unique} · ${format}`;
  }

  async function save(): Promise<void> {
    if (await presets.saveCurrent(newName)) newName = '';
  }

  function startEdit(preset: PresetRecord): void {
    confirmingId = null;
    editingId = preset.id;
    editName = preset.name;
    replaceConfig = false;
  }

  async function saveEdit(): Promise<void> {
    if (editingId && (await presets.edit(editingId, { name: editName, replaceConfig }))) editingId = null;
  }

  async function confirmDelete(id: string): Promise<void> {
    await presets.remove(id);
    confirmingId = null;
  }

  /** Lleva el foco al control recién mostrado (teclado y lectores de pantalla). */
  function focusOnMount(node: HTMLElement): void {
    node.focus();
  }
</script>

<div class="wrap">
  <header>
    <h2>Presets</h2>
    <p class="lead">Guarda configuraciones de marca de agua y vuelve a usarlas. Se guardan solo en este dispositivo.</p>
  </header>

  {#if presets.error}
    <div class="banner error" role="alert">
      <span>{presets.error}</span>
      <button type="button" class="x" aria-label="Cerrar aviso" onclick={() => presets.dismissMessages()}>×</button>
    </div>
  {/if}
  {#if presets.notice}
    <div class="banner" role="status">
      <span>{presets.notice}</span>
      {#if presets.appliedId}
        <button type="button" class="btn" onclick={() => workspace.go('protect')}>Ir a Proteger</button>
      {/if}
      <button type="button" class="x" aria-label="Cerrar aviso" onclick={() => presets.dismissMessages()}>×</button>
    </div>
  {/if}

  <section class="box">
    <h3>Guardar la configuración actual</h3>
    <form
      class="save"
      onsubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label for="{uid}-new">Nombre del preset</label>
      <div class="row">
        <input
          id="{uid}-new"
          type="text"
          bind:value={newName}
          maxlength={PRESET_NAME_MAX}
          placeholder="Ej. Fotos de familia"
          autocomplete="off"
          disabled={!presets.storageReady}
        />
        <button type="submit" class="btn primary" disabled={presets.busy || !presets.storageReady || newName.trim() === ''}>
          Guardar
        </button>
      </div>
    </form>
    {#if !presets.storageReady}
      <p class="note warn">No se puede guardar en este navegador. El preset de fábrica sigue disponible para aplicarlo.</p>
    {/if}
  </section>

  {#if presets.loading}
    <p class="loading" role="status"><span class="spinner" aria-hidden="true"></span> Cargando presets…</p>
  {/if}

  <ul class="list" aria-label="Presets disponibles">
    {#each presets.items as preset (preset.id)}
      {@const factory = isFactoryPreset(preset)}
      {@const missing = findMissingFontIds(preset.config)}
      <li class="box item" class:factory>
        <div class="head">
          <h3>{preset.name}</h3>
          <span class="badges">
            {#if factory}<span class="badge">De fábrica · solo lectura</span>{/if}
            {#if preset.id === effectiveDefaultId}<span class="badge accent">Predeterminado</span>{/if}
          </span>
        </div>
        <p class="meta">{describe(preset)}</p>
        {#if !factory}
          <p class="meta">Modificado: {dateFormat.format(preset.updatedAt)}</p>
        {/if}
        {#if missing.length > 0}
          <p class="note warn">
            Usa la tipografía «{missing[0]}», que ya no está disponible. No se puede aplicar; puedes renombrarlo,
            duplicarlo o eliminarlo.
          </p>
        {/if}

        {#if editingId === preset.id}
          <form
            class="edit"
            onsubmit={(event) => {
              event.preventDefault();
              void saveEdit();
            }}
          >
            <label for="{uid}-edit-{preset.id}">Nombre</label>
            <input
              id="{uid}-edit-{preset.id}"
              type="text"
              bind:value={editName}
              maxlength={PRESET_NAME_MAX}
              autocomplete="off"
              use:focusOnMount
            />
            <label class="check">
              <input type="checkbox" bind:checked={replaceConfig} />
              Reemplazar la configuración guardada por la actual del editor
            </label>
            <div class="actions">
              <button type="submit" class="btn primary" disabled={presets.busy || editName.trim() === ''}>Guardar cambios</button>
              <button type="button" class="btn ghost" onclick={() => (editingId = null)}>Cancelar</button>
            </div>
          </form>
        {:else if confirmingId === preset.id}
          <div class="confirm" role="alertdialog" aria-label="Confirmar eliminación de {preset.name}">
            <p>¿Eliminar «{preset.name}»? Esta acción no se puede deshacer.</p>
            <div class="actions">
              <button type="button" class="btn danger" disabled={presets.busy} onclick={() => void confirmDelete(preset.id)}>
                Eliminar
              </button>
              <button type="button" class="btn ghost" onclick={() => (confirmingId = null)} use:focusOnMount>Cancelar</button>
            </div>
          </div>
        {:else}
          <div class="actions">
            <button
              type="button"
              class="btn primary"
              disabled={presets.busy || missing.length > 0}
              onclick={() => void presets.apply(preset.id)}
            >
              Aplicar
            </button>
            {#if !factory}
              <button type="button" class="btn" disabled={presets.busy} onclick={() => startEdit(preset)}>Editar</button>
            {/if}
            <button
              type="button"
              class="btn"
              disabled={presets.busy || !presets.storageReady}
              onclick={() => void presets.duplicate(preset.id)}
            >
              Duplicar
            </button>
            {#if !factory}
              {#if presets.defaultId === preset.id}
                <button type="button" class="btn" disabled={presets.busy} onclick={() => void presets.setDefault(null)}>
                  Quitar predeterminado
                </button>
              {:else}
                <button type="button" class="btn" disabled={presets.busy} onclick={() => void presets.setDefault(preset.id)}>
                  Usar como predeterminado
                </button>
              {/if}
              <button
                type="button"
                class="btn ghost"
                disabled={presets.busy}
                onclick={() => {
                  editingId = null;
                  confirmingId = preset.id;
                }}
              >
                Eliminar
              </button>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  {#if presets.storageReady && !presets.loading && userCount === 0}
    <div class="empty">
      <p>Todavía no tienes presets propios.</p>
      <p class="note">Ajusta la marca de agua en «Proteger» y guárdala aquí con un nombre.</p>
      <button type="button" class="btn" onclick={() => workspace.go('protect')}>Ir a Proteger</button>
    </div>
  {/if}

  {#if presets.storageReady}
    <p class="note storage" role="status">
      {#if presets.persistence === 'persistent'}
        El navegador marcó el almacenamiento como persistente. Aun así, borrar los datos del sitio elimina los presets.
      {:else if presets.persistence === 'not-persistent'}
        El navegador no garantiza conservar los presets: podrían borrarse si limpias los datos del sitio o el dispositivo necesita espacio.
      {:else if presets.persistence === 'unsupported'}
        Este navegador no permite pedir almacenamiento persistente: los presets podrían borrarse si el dispositivo necesita espacio.
      {/if}
      Cada dispositivo guarda sus propios presets.
    </p>
  {/if}
</div>
<style>
  .wrap { max-width: 720px; margin: 0 auto; padding: 28px 18px 48px; display: flex; flex-direction: column; gap: 16px; }
  h2 { font-size: 26px; margin-bottom: 4px; }
  h3 { font-size: 16px; font-weight: 650; overflow-wrap: anywhere; }
  .lead, .meta, .note { color: var(--muted); }
  .meta { font-size: 13.5px; }
  .note { font-size: 13px; }
  .note.warn { color: #ffd2a3; }
  .box { display: flex; flex-direction: column; gap: 10px; padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
  .item.factory { border-style: dashed; border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .badges { display: flex; gap: 6px; flex-wrap: wrap; }
  .badge { padding: 2px 10px; border: 1px dashed var(--border); border-radius: 99px; font-size: 12px; color: var(--muted); }
  .badge.accent { border: 1px solid var(--accent); color: var(--accent); }
  label { font-size: 13px; color: var(--muted); }
  .save, .edit { display: flex; flex-direction: column; gap: 6px; }
  .row { display: flex; gap: 8px; }
  .check { display: flex; align-items: center; gap: 8px; color: var(--text); }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .confirm { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--danger); border-radius: 8px; }
  .btn.danger { background: var(--danger); border-color: var(--danger); color: #2a0a06; font-weight: 650; }
  .banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); background: var(--surface); border-radius: 8px; font-size: 13.5px; }
  .banner span { flex: 1; }
  .banner.error { border-color: var(--danger); color: #ffd2cc; }
  .x { flex: none; width: 28px; height: 28px; line-height: 1; background: transparent; border: 0; color: inherit; font-size: 20px; }
  .empty { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 18px; border: 1.5px dashed var(--border); border-radius: var(--radius); }
  .loading { display: flex; align-items: center; gap: 10px; color: var(--muted); }
  .spinner { width: 18px; height: 18px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 520px) { .row { flex-direction: column; } }
</style>