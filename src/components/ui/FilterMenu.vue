<template>
  <v-menu
    v-model="open"
    :close-on-content-click="!multiple"
    :activator-props="{ 'aria-haspopup': 'listbox' }"
    location="bottom start"
    max-height="420"
    offset="6"
  >
    <template #activator="{ props: menuProps }">
      <button
        v-bind="menuProps"
        class="ui-btn filter-chip"
        :class="{ 'filter-chip--on': active }"
        :aria-label="ariaLabel ?? (active ? `${label}: ${valueText}` : label)"
      >
        <v-icon v-if="icon" :icon="icon" size="18" />
        <span>{{ label }}<template v-if="active && valueText">: <b>{{ valueText }}</b></template></span>
        <v-icon icon="mdi-chevron-down" size="18" />
      </button>
    </template>

    <div class="filter-list">
      <!-- Пустой @update:selected делает выбор контролируемым: меняет его только toggle -->
      <v-list
        selectable
        :selected="selected"
        :select-strategy="multiple ? 'leaf' : 'single-leaf'"
        :aria-label="ariaLabel ?? label"
        :class="{ 'pb-0': showClear }"
        bg-color="transparent"
        density="compact"
        @update:selected="() => {}"
      >
        <v-list-item
          v-for="item in items"
          :key="String(item.value)"
          :value="item.value"
          :active="isSelected(item.value)"
          :title="item.title"
          @click="toggle(item.value)"
        >
          <template v-if="multiple" #prepend>
            <v-icon :icon="isSelected(item.value) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'" size="20" />
          </template>
        </v-list-item>
      </v-list>
      <template v-if="showClear">
        <v-divider class="my-1" />
        <v-list class="pt-0" bg-color="transparent" density="compact">
          <v-list-item prepend-icon="mdi-close" title="Сбросить" @click="clear" />
        </v-list>
      </template>
    </div>
  </v-menu>
</template>

<script setup lang="ts" generic="T extends string | number">
import { computed, ref } from 'vue'

export interface FilterItem<V> {
  value: V
  title: string
}

const props = withDefaults(defineProps<{
  label: string
  items: FilterItem<T>[]
  modelValue: T[] | T | null
  multiple?: boolean
  clearable?: boolean
  icon?: string
  highlight?: boolean
  ariaLabel?: string
}>(), { multiple: false, clearable: true, icon: undefined, highlight: undefined, ariaLabel: undefined })

const emit = defineEmits<{ 'update:modelValue': [value: T[] | T | null] }>()

const open = ref(false)

const selected = computed<T[]>(() => {
  const value = props.modelValue
  if (Array.isArray(value)) return value
  return value == null ? [] : [value]
})

const active = computed(() => props.highlight ?? selected.value.length > 0)

const showClear = computed(() => props.clearable && active.value)

const valueText = computed(() => {
  const titles = selected.value.map(v => props.items.find(i => i.value === v)?.title ?? String(v))
  if (titles.length === 0) return ''
  return titles.length === 1 ? titles[0] : `${titles[0]} +${titles.length - 1}`
})

function isSelected (value: T): boolean {
  return selected.value.includes(value)
}

function toggle (value: T): void {
  if (props.multiple) {
    const next = isSelected(value) ? selected.value.filter(v => v !== value) : [...selected.value, value]
    emit('update:modelValue', next)
  } else {
    emit('update:modelValue', isSelected(value) && props.clearable ? null : value)
  }
}

function clear (): void {
  emit('update:modelValue', props.multiple ? [] : null)
  open.value = false
}
</script>

<style>
/* Без scoped: список рисуется в оверлее */
.filter-list {
  min-width: 200px;
  overflow: auto;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line-2), 0 16px 40px rgba(0, 0, 0, 0.5);
  border-radius: 12px;
}
</style>
