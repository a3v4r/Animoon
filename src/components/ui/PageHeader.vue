<template>
  <header class="page-header">
    <div class="title-row">
      <h1 class="title font-display">{{ title }}</h1>
      <span v-if="subtitle" class="subtitle" :title="subtitle">{{ subtitle }}</span>
      <span class="spacer" />
      <slot name="actions" />
    </div>
    <slot />
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string, subtitle?: string }>()
</script>

<style scoped>
.page-header {
  padding: 16px 40px 0;
}

.title-row {
  display: flex;
  align-items: baseline;
  gap: 8px 16px;
}

.title {
  flex: none;
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 36px;
}

.subtitle {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
  color: var(--text-3);
}

.spacer {
  flex: 1;
}
</style>
