<template>
  <div class="empty-state" :role="alert ? 'alert' : undefined">
    <v-icon v-if="icon" :icon="icon" size="40" class="icon" />
    <div v-if="title" class="title">{{ title }}</div>
    <div v-if="text" class="text" :class="{ 'allow-select': alert }">{{ text }}</div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ icon?: string, title?: string, text?: string, alert?: boolean }>()
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 64px 16px;
  text-align: center;
}

.icon {
  color: var(--text-3);
  margin-bottom: 4px;
}

.title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
}

.text {
  max-width: 420px;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-3);
}
</style>
