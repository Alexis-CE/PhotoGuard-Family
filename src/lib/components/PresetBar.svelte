<script lang="ts">
  import { presets } from '$lib/state/presets.svelte';
  import { findMissingFontIds } from '$lib/services/presetValidation';
  import { isFactoryPreset, PRESET_NAME_MAX } from '$lib/types/preset';

  const uid = $props.id();

  let selectedId = $state('');
  let saving = $state(false);
  let name = $state('');
  let feedback = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const effectiveDefaultId = $derived(presets.defaultId ?? presets.items[0]?.id ?? '');
  const selected = $derived(presets.items.find((p) => p.id === selectedId));
  const unavailable = $derived(selected ? findMissingFontIds(selected.config).length > 0 : false);

  // Mantiene una selección válida (al cargar, o si el preset elegido se elimina desde Presets).
  $effect(() => {
    if (!presets.items.some((p) => p.id === selectedId)) selectedId = effectiveDefaultId;
  });

  function label(id: string, presetName: string, factory: boolean): string {
    if (id === effectiveDefaultId) return `${presetName} · predeterminado`;
    return factory ? `${presetName} (fábrica)` : presetName;
  }

  /** Muestra el resultado de la acción lanzada desde aquí; los avisos globales no se reutilizan. */
  function report(ok: boolean): void {
    const text = ok ? presets.notice : presets.error;
    feedback = text ? { kind: ok ? 'ok' : 'error', text } : null;
  }

  async function applySelected(): Promise<void> {
    if (!selectedId) return;
    report(await presets.apply(selectedId));
  }

  async function saveCurrent(): Promise<void> {
    const ok = await presets.saveCurrent(name);
    report(ok);
    if (ok) {
      name = '';
      saving = false;
    }
  }

  function cancelSave(): void {
    saving = false;
    name = '';
  }

  /** Lleva el foco al campo recién mostrado (teclado y lectores de pantalla). */
  function focusOnMount(node: HTMLElement): void {
    node.focus();
  }
</script>

<div class="presetbar">
  <label class="cap" for="{uid}-select">Preset</label>
  <div class="row">
    <select id="{uid}-select" bind:value={selectedId} disabled={presets.busy}>
      {#each presets.items as preset (preset.id)}
        <option value={preset.id}>{label(preset.id, preset.name, isFactoryPreset(preset))}</option>
      {/each}
    </select>
    <button type="button" class="btn" disabled={presets.busy || !selectedId || unavailable} onclick={() => void applySelected()}>
      Aplicar
    </button>
  </div>
  {#if unavailable}
    <p class="msg error" role="alert">Este preset usa una tipografía que ya no está disponible; no se puede aplicar.</p>
  {/if}

  {#if saving}
    <form
      class="saveform"
      onsubmit={(event) => {
        event.preventDefault();
        void saveCurrent();
      }}
    >
      <label class="cap" for="{uid}-name">Nombre del preset</label>
      <input
        id="{uid}-name"
        type="text"
        bind:value={name}
        maxlength={PRESET_NAME_MAX}
        placeholder="Ej. Fotos de familia"
        autocomplete="off"
        use:focusOnMount
      />
      <div class="row">
        <button type="submit" class="btn primary" disabled={presets.busy || name.trim() === ''}>Guardar</button>
        <button type="button" class="btn ghost" onclick={cancelSave}>Cancelar</button>
      </div>
    </form>
  {:else}
    <button
      type="button"
      class="btn ghost"
      disabled={presets.busy || !presets.storageReady}
      onclick={() => {
        feedback = null;
        saving = true;
      }}
    >
      Guardar como preset
    </button>
    {#if !presets.storageReady}
      <p class="msg">No se puede guardar presets en este navegador.</p>
    {/if}
  {/if}

  {#if feedback}
    <div class="msg" class:error={feedback.kind === 'error'} role={feedback.kind === 'error' ? 'alert' : 'status'}>
      <span>{feedback.text}</span>
      <button type="button" class="x" aria-label="Cerrar aviso" onclick={() => (feedback = null)}>×</button>
    </div>
  {/if}
</div>

<style>
  .presetbar {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cap {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  .row select {
    flex: 1;
    min-width: 0;
  }

  .saveform {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .msg {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    font-size: 13px;
    color: var(--muted);
  }

  .msg.error {
    color: #ffd2cc;
  }

  .x {
    flex: none;
    width: 24px;
    height: 24px;
    line-height: 1;
    background: transparent;
    border: 0;
    color: inherit;
    font-size: 20px;
  }
</style>
