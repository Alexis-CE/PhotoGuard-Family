<script lang="ts" generics="T extends string">
  interface Props {
    label: string;
    options: { value: T; label: string }[];
    value: T;
  }

  let { label, options, value = $bindable() }: Props = $props();

  const name = $props.id();
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <label class:active={value === option.value}>
      <input type="radio" {name} value={option.value} bind:group={value} />
      <span>{option.label}</span>
    </label>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    padding: 3px;
    gap: 3px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 9px;
  }

  label {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    text-align: center;
    border-radius: 6px;
    cursor: pointer;
  }

  label span {
    display: block;
    padding: 7px 6px;
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  label.active {
    background: var(--surface-2);
    box-shadow: 0 0 0 1px var(--border);
  }

  label.active span {
    color: var(--text);
    font-weight: 550;
  }

  input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    margin: 0;
  }

  label:has(input:focus-visible) {
    outline: 2px solid var(--accent);
  }
</style>
