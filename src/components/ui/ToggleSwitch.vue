<template>
  <label class="toggle">
    <input :id="id" v-model="model" class="toggle-input" role="switch" type="checkbox">
    <span class="track" />
    <slot />
  </label>
</template>

<script setup lang="ts">
defineProps<{ id?: string }>()
const model = defineModel<boolean>({ default: false })
</script>

<style scoped>
/* Переключатель «Кинотеатра» 32×18 (макет .sw-t): включён — бирюзовая обводка и бегунок. */
.toggle {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
  cursor: pointer;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.track {
  position: relative;
  width: 32px;
  height: 18px;
  flex: none;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.16);
  transition: background-color 0.15s;
}

.track::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-2);
  transition: transform 0.15s, background-color 0.15s;
}

.toggle-input:checked + .track {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px rgba(92, 225, 230, 0.45);
}

.toggle-input:checked + .track::after {
  transform: translateX(14px);
  background: var(--accent);
}

.toggle-input:focus-visible + .track {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
