<script setup lang="ts">
import type { ChannelContentRule, VideoContentCategory } from '~/lib/contentRules'

defineProps<{
  rule: ChannelContentRule
}>()

const emit = defineEmits<{
  categoryExcluded: [payload: { category: VideoContentCategory, excluded: boolean }]
  channelExcluded: [excluded: boolean]
}>()

const categories = [
  { key: 'short', label: 'Cortos' },
  { key: 'long', label: 'Largos' },
  { key: 'live', label: 'Directos' }
] as const

function checked(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}
</script>

<template>
  <div class="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
    <label class="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 p-3 font-semibold text-slate-700">
      <input
        type="checkbox"
        aria-label="Excluir canal"
        :checked="rule.excluded"
        @change="emit('channelExcluded', checked($event))"
      >
      Excluir canal
    </label>
    <label
      v-for="category in categories"
      :key="category.key"
      class="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 p-3 text-slate-700"
      :class="{ 'opacity-50': rule.excluded }"
    >
      <input
        type="checkbox"
        :aria-label="`Excluir ${category.label.toLowerCase()}`"
        :checked="rule.excludedCategories[category.key]"
        :disabled="rule.excluded"
        @change="emit('categoryExcluded', {
          category: category.key,
          excluded: checked($event)
        })"
      >
      {{ category.label }}
    </label>
  </div>
</template>
