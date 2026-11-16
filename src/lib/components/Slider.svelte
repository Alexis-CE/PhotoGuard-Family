<script lang="ts">
  interface Props {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
  }

  let { label, value = $bindable(), min, max, step = 1, unit = '' }: Props = $props();

  const id = $props.id();
  const shown = $derived(Number.isInteger(value) ? String(value) : value.toFixed(1));
</script>

<div class="slider">
  <label for={id}>
    <span>{label}</span>
    <output for={id}>{shown}{unit}</output>
  </label>
  <input {id} type="range" {min} {max} {step} bind:value />
</div>

<style>
  .slider {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: var(--muted);
  }

  output {
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }
</style>
