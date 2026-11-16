<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
  import Protect from './routes/Protect.svelte';
  import ComingSoon from './routes/ComingSoon.svelte';
  import { workspace } from '$lib/state/workspace.svelte';
  import { SECTIONS } from '$lib/sections';

  const current = $derived(SECTIONS.find((s) => s.id === workspace.section) ?? SECTIONS[0]);
</script>

<div class="shell">
  <header class="topbar">
    <svg class="mark" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" stroke-width="5" />
      <circle cx="32" cy="32" r="9" fill="currentColor" />
    </svg>
    <h1>PhotoGuard <span>Family</span></h1>
    <p class="privacy">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" /></svg>
      Tus fotos no salen de este dispositivo
    </p>
  </header>

  <Nav />

  <main class="main">
    {#if current.id === 'protect'}
      <Protect />
    {:else}
      <ComingSoon section={current} />
    {/if}
  </main>
</div>

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

  .privacy {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
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
