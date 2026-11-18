<script lang="ts">
  import { pwa } from '$lib/services/pwa.svelte';
</script>

{#if pwa.canPromptInstall}
  <aside class="install" aria-label="Instalar PhotoGuard">
    <div class="copy">
      <h3>Instala PhotoGuard</h3>
      <p>Ábrela desde tu pantalla de inicio, a pantalla completa y lista para usarse sin conexión.</p>
    </div>
    <div class="actions">
      <button type="button" class="btn primary" onclick={() => void pwa.install()}>Instalar</button>
      <button type="button" class="btn ghost" onclick={() => pwa.dismissInstallHint()}>Ahora no</button>
    </div>
  </aside>
{:else if pwa.showIosHint}
  <aside class="install" aria-label="Añadir PhotoGuard a la pantalla de inicio">
    <div class="copy">
      <h3>Añádela a tu pantalla de inicio</h3>
      <ol>
        <li>
          Toca <strong>Compartir</strong>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M6 12v8h12v-8" /></svg>
          en la barra de Safari.
        </li>
        <li>Elige <strong>«Añadir a pantalla de inicio»</strong>.</li>
        <li>Confirma con <strong>«Añadir»</strong>.</li>
      </ol>
    </div>
    <div class="actions">
      <button type="button" class="btn ghost" onclick={() => pwa.dismissInstallHint()}>Entendido</button>
    </div>
  </aside>
{/if}

<style>
  .install {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 16px;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
  }

  .copy {
    flex: 1 1 260px;
    min-width: 0;
  }

  h3 {
    font-size: 16px;
    margin-bottom: 4px;
  }

  p,
  li {
    color: var(--muted);
    font-size: 14px;
  }

  ol {
    margin: 6px 0 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  li strong {
    color: var(--text);
    font-weight: 600;
  }

  svg {
    width: 16px;
    height: 16px;
    vertical-align: -3px;
    fill: none;
    stroke: var(--accent);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .actions {
    display: flex;
    gap: 8px;
  }
</style>
