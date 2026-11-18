<script lang="ts">
  import { pwa } from '$lib/services/pwa.svelte';
  import { workspace } from '$lib/state/workspace.svelte';

  let confirming = $state(false);

  const showUpdate = $derived(pwa.needRefresh && !pwa.snoozed);
  const hasOpenPhoto = $derived(workspace.photo !== null);

  async function update(): Promise<void> {
    // Con una foto abierta pedimos confirmación: recargar cierra la foto y los ajustes no guardados.
    if (hasOpenPhoto && !confirming) {
      confirming = true;
      return;
    }
    await pwa.applyUpdate(workspace.busy);
  }

  function later(): void {
    confirming = false;
    pwa.snooze();
  }
</script>

{#if showUpdate}
  <div class="toast" role="alertdialog" aria-labelledby="upd-title" aria-describedby="upd-desc">
    <h3 id="upd-title">Hay una nueva versión</h3>
    {#if workspace.busy}
      <p id="upd-desc">Se está procesando una foto. Podrás actualizar cuando termine.</p>
    {:else if confirming}
      <p id="upd-desc">
        La app se recargará y se cerrará la foto abierta (los ajustes no guardados se perderán). ¿Continuar?
      </p>
    {:else}
      <p id="upd-desc">Mientras tanto puedes seguir usando la versión actual.</p>
    {/if}
    <div class="actions">
      <button
        type="button"
        class="btn primary"
        disabled={workspace.busy || pwa.applying}
        onclick={() => void update()}
      >
        {pwa.applying ? 'Actualizando…' : confirming ? 'Sí, actualizar' : 'Actualizar'}
      </button>
      <button type="button" class="btn ghost" disabled={pwa.applying} onclick={later}>
        {confirming ? 'Cancelar' : 'Más tarde'}
      </button>
    </div>
  </div>
{:else if pwa.offlineReady}
  <div class="toast" role="status">
    <h3>Lista para usarse sin conexión</h3>
    <p>PhotoGuard ya está guardada en este dispositivo.</p>
    <div class="actions">
      <button type="button" class="btn ghost" onclick={() => pwa.dismissOfflineReady()}>Entendido</button>
    </div>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    right: 16px;
    bottom: calc(16px + var(--safe-bottom));
    z-index: 20;
    width: min(380px, calc(100vw - 32px));
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--surface-2);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
  }

  h3 {
    font-size: 15px;
  }

  p {
    font-size: 13.5px;
    color: var(--muted);
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }

  @media (max-width: 860px) {
    .toast {
      left: 12px;
      right: 12px;
      width: auto;
      /* por encima de la barra de navegación inferior */
      bottom: calc(68px + var(--safe-bottom));
    }
  }
</style>
