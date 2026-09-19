<script setup lang="ts">
import type { ChannelContentRule, VideoContentCategory } from '~/lib/contentRules'

defineProps<{
  channelTitle: string
  rule: ChannelContentRule
}>()

const emit = defineEmits<{
  categoryExcluded: [payload: { category: VideoContentCategory, excluded: boolean }]
  channelExcluded: [excluded: boolean]
}>()

const categories = [
  { key: 'short', label: 'Vídeos cortos' },
  { key: 'long', label: 'Vídeos largos' },
  { key: 'live', label: 'Emisiones en directo' }
] as const

function checked(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}
</script>

<template>
  <fieldset class="grid min-w-0 gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
    <legend class="sr-only">Reglas de contenido para {{ channelTitle }}</legend>
    <label class="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 p-3 font-semibold text-slate-700">
      <input
        type="checkbox"
        class="size-6 shrink-0 accent-red-600"
        :aria-label="`Excluir canal ${channelTitle}`"
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
        class="size-6 shrink-0 accent-red-600"
        :aria-label="`Excluir ${category.label.toLowerCase()} de ${channelTitle}`"
        :checked="rule.excludedCategories[category.key]"
        :disabled="rule.excluded"
        @change="emit('categoryExcluded', {
          category: category.key,
          excluded: checked($event)
        })"
      >
      {{ category.label }}
    </label>
  </fieldset>
</template>
