<template>
  <v-menu location="bottom end" max-height="480" offset="4" @update:model-value="onToggle">
    <template #activator="{ props: menuProps }">
      <button v-bind="menuProps" class="ui-btn bell" title="Новые серии" aria-label="Новые серии">
        <v-icon icon="mdi-bell-outline" size="20" />
        <span v-if="notifications.unread > 0" class="dot">{{ notifications.unread > 9 ? '9+' : notifications.unread }}</span>
      </button>
    </template>

    <v-list density="compact" width="380">
      <v-list-subheader class="d-flex">
        Новые серии из избранного
      </v-list-subheader>
      <v-list-item v-if="notifications.items.length === 0" class="text-medium-emphasis">
        {{ account.isAuthorized ? 'Пока ничего нового.' : 'Войдите, чтобы получать уведомления о сериях из избранного.' }}
      </v-list-item>
      <v-list-item
        v-for="item in notifications.items"
        :key="item.id"
        :subtitle="`${item.ordinal} серия · ${formatAgo(item.createdAt)}`"
        :title="item.title"
        :to="{ name: 'watch', params: { id: item.releaseId, ordinal: item.ordinal } }"
      >
        <template #prepend>
          <v-avatar rounded="sm" size="40">
            <v-img :src="item.poster" cover />
          </v-avatar>
        </template>
      </v-list-item>
      <template v-if="notifications.items.length > 0">
        <v-divider />
        <v-list-item class="text-medium-emphasis" title="Очистить" @click="notifications.clear()" />
      </template>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { useAccountStore } from '@/stores/account'
import { useNotificationsStore } from '@/stores/notifications'

const account = useAccountStore()
const notifications = useNotificationsStore()

function onToggle (open: boolean): void {
  if (!open) notifications.markAllRead()
}

function formatAgo (time: number): string {
  const minutes = Math.round((Date.now() - time) / 60000)
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ч назад`
  return new Date(time).toLocaleDateString('ru-RU')
}
</script>

<style scoped>
.bell {
  position: relative;
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--glass);
  border: 1px solid var(--glass-line);
  color: var(--text);
  font-size: 20px;
}

.bell:hover {
  background: rgba(40, 44, 54, 0.85);
}

.bell:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.dot {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  border: 2px solid var(--bg);
  background: var(--warm);
  color: var(--warm-ink);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}
</style>
