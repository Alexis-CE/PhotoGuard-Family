<script lang="ts">
  import { workspace } from '$lib/state/workspace.svelte';
  import { NAV_ITEMS } from '$lib/sections';
</script>

<nav aria-label="Secciones">
  {#each NAV_ITEMS as section (section.id)}
    <button
      type="button"
      class:active={workspace.section === section.id}
      aria-current={workspace.section === section.id ? 'page' : undefined}
      onclick={() => workspace.go(section.id)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">{@html section.icon}</svg>
      <span class="label long">{section.label}</span>
      <span class="label short">{section.shortLabel}</span>
      {#if !section.ready}<small>pronto</small>{/if}
    </button>
  {/each}
</nav>

<style>
  nav {
    grid-area: nav;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 10px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    overflow-y: auto;
  }

  button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: transparent;
    border: 0;
    border-radius: 8px;
    color: var(--muted);
    text-align: left;
    transition: background 0.15s, color 0.15s;
  }

  button:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  button.active {
    background: var(--surface-2);
    color: var(--text);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  svg {
    width: 20px;
    height: 20px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  button.active svg {
    color: var(--accent);
  }

  .short {
    display: none;
  }

  small {
    margin-left: auto;
    font-size: 11px;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 99px;
    padding: 1px 7px;
  }

  @media (max-width: 860px) {
    nav {
      flex-direction: row;
      justify-content: space-around;
      gap: 0;
      padding: 6px 4px calc(6px + var(--safe-bottom));
      border-right: 0;
      border-top: 1px solid var(--border);
      overflow: hidden;
    }

    button {
      flex: 1 1 0;
      min-width: 0;
      flex-direction: column;
      gap: 3px;
      padding: 6px 2px;
      text-align: center;
      font-size: 11px;
    }

    button.active {
      box-shadow: inset 0 3px 0 var(--accent);
    }

    .long {
      display: none;
    }

    .short {
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      display: none;
    }
  }
</style>
