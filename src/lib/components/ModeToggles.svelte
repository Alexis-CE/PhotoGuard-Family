<script lang="ts">
  import { workspace as ws } from '$lib/state/workspace.svelte';
  import { blockedMessage, modeParts, nextMode, type ModeTarget } from '$lib/utils/modes';

  const items: { target: ModeTarget; label: string }[] = [
    { target: 'pattern', label: 'Patrón' },
    { target: 'hybrid', label: 'Híbrido' },
    { target: 'emblem', label: 'Emblema' }
  ];

  const parts = $derived(modeParts(ws.config.mode));
  let hint = $state<string | null>(null);

  /** En `click` el navegador ya alternó el checkbox: si el cambio no es válido se cancela (se revierte). */
  function toggle(event: Event, target: ModeTarget): void {
    const input = event.currentTarget as HTMLInputElement;
    const next = nextMode(ws.config.mode, target, input.checked);
    if (next === null) {
      event.preventDefault();
      hint = blockedMessage(target);
      return;
    }
    ws.config.mode = next;
    hint = null;
  }
</script>

<div class="modes" role="group" aria-label="Modo de protección">
  {#each items as item (item.target)}
    <label class="tile" class:on={parts[item.target]}>
      <input type="checkbox" checked={parts[item.target]} onclick={(event) => toggle(event, item.target)} />
      <span class="box" aria-hidden="true">
        <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>
      </span>
      <span class="text">{item.label}</span>
    </label>
  {/each}
</div>
{#if hint}
  <p class="hint" role="status">{hint}</p>
{/if}

<style>
  .modes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .tile {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    min-height: 46px;
    padding: 0 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 9px;
    color: var(--muted);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }

  .tile.on {
    background: var(--surface-2);
    border-color: color-mix(in srgb, var(--accent) 70%, var(--border));
    color: var(--text);
  }

  .tile input {
    position: absolute;
    inset: 0;
    opacity: 0;
    margin: 0;
    cursor: pointer;
  }

  .tile:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .box {
    flex: none;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 1.5px solid var(--muted);
    border-radius: 6px;
    transition: background 0.15s, border-color 0.15s;
  }

  .box svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: var(--accent-ink);
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0;
    transform: scale(0.6);
    transition: opacity 0.15s, transform 0.15s;
  }

  .tile.on .box {
    background: var(--accent);
    border-color: var(--accent);
  }

  .tile.on .box svg {
    opacity: 1;
    transform: scale(1);
  }

  .text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13.5px;
    font-weight: 550;
  }

  .hint {
    margin-top: 6px;
    font-size: 12.5px;
    color: #ffd2a3;
  }

  /* Pantallas muy angostas (≈320 px): menos holgura para que no se recorte «Emblema». */
  @media (max-width: 340px) {
    .modes {
      gap: 6px;
    }

    .tile {
      gap: 5px;
      padding: 0 4px;
    }

    .text {
      font-size: 13px;
    }
  }
</style>
