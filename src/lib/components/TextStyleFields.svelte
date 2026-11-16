<script lang="ts">
  import Slider from './Slider.svelte';
  import { FONT_OPTIONS } from '$lib/engines/fonts';
  import type { TextStyle } from '$lib/types/watermark';

  let { style = $bindable() }: { style: TextStyle } = $props();

  const uid = $props.id();
</script>

<div class="fields">
  <div class="field">
    <label for="{uid}-text">Texto</label>
    <input id="{uid}-text" type="text" bind:value={style.text} maxlength="80" placeholder="Escribe tu marca de agua" autocomplete="off" />
  </div>

  <div class="row">
    <div class="field grow">
      <label for="{uid}-font">Tipografía</label>
      <select id="{uid}-font" bind:value={style.fontId}>
        {#each FONT_OPTIONS as font (font.id)}
          <option value={font.id}>{font.label}</option>
        {/each}
      </select>
    </div>
    <div class="field">
      <label for="{uid}-color">Color</label>
      <input id="{uid}-color" type="color" bind:value={style.color} />
    </div>
  </div>

  <Slider label="Tamaño" bind:value={style.size} min={1} max={30} step={0.5} unit="%" />
  <Slider label="Grosor" bind:value={style.thickness} min={0} max={12} step={0.5} unit="%" />
  <Slider label="Opacidad" bind:value={style.opacity} min={1} max={100} unit="%" />
  <Slider label="Rotación" bind:value={style.rotation} min={-180} max={180} unit="°" />
</div>

<style>
  .fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }

  .grow {
    flex: 1;
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    font-size: 13px;
    color: var(--muted);
  }
</style>
