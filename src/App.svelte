<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
  import UpdateBanner from '$lib/components/UpdateBanner.svelte';
  import Home from './routes/Home.svelte';
  import Protect from './routes/Protect.svelte';
  import Presets from './routes/Presets.svelte';
  import ComingSoon from './routes/ComingSoon.svelte';
  import { workspace } from '$lib/state/workspace.svelte';
  import { pwa } from '$lib/services/pwa.svelte';
  import { findSection } from '$lib/sections';

  const current = $derived(findSection(workspace.section));
</script>

<div class="shell">
  <header class="topbar">
    <button type="button" class="brand" onclick={() => workspace.go('home')} aria-label="PhotoGuard Family: ir al inicio">
      <svg class="mark" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" stroke-width="5" />
        <circle cx="32" cy="32" r="9" fill="currentColor" />
      </svg>
      <h1>PhotoGuard <span>Family</span></h1>
    </button>

    <div class="status">
      {#if !pwa.online}
        <span class="chip" role="status">Sin conexión</span>
      {/if}
      {#if pwa.needRefresh && pwa.snoozed}
        <button type="button" class="chip update" onclick={() => pwa.reopenUpdate()}>Actualización disponible</button>
      {/if}
      <p class="privacy">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" /></svg>
        Tus fotos no salen de este dispositivo
      </p>
    </div>
  </header>

  <Nav />

  <main class="main">
    {#if current.id === 'home'}
      <Home />
    {:else if current.id === 'protect'}
      <Protect />
    {:else if current.id === 'presets'}
      <Presets />
    {:else}
      <ComingSoon section={current} />
    {/if}
  </main>
</div>

<UpdateBanner />

<style>
  .shell {
    display: grid;
    height: 100%;
    grid-template-columns: 220px minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      'top top'
      'nav main';
  }

  .topbar {
    grid-area: top;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: calc(10px + var(--safe-top)) 18px 10px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0;
    background: transparent;
    border: 0;
    color: inherit;
  }

  .mark {
    width: 26px;
    height: 26px;
    color: var(--accent);
    flex: none;
  }

  h1 {
    font-size: 17px;
    font-weight: 650;
    letter-spacing: 0.01em;
  }

  h1 span {
    color: var(--muted);
    font-weight: 450;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .chip {
    padding: 3px 10px;
    border: 1px solid var(--border);
    border-radius: 99px;
    background: transparent;
    font-size: 12px;
    color: var(--muted);
  }

  .chip.update {
    border-color: var(--accent);
    color: var(--accent);
  }

  .privacy {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--muted);
  }

  .privacy svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .main {
    grid-area: main;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }

  @media (max-width: 860px) {
    .shell {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-areas:
        'top'
        'main'
        'nav';
    }

    .privacy {
      display: none;
    }
  }
</style>
