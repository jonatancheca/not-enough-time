<script setup lang="ts">
export interface StateNoticeContent {
  detail: string
  title: string
  tone: 'amber' | 'blue' | 'red'
}

defineProps<{
  notice: StateNoticeContent | null
  refreshing: boolean
  retryable: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <section
    v-if="notice"
    class="rounded-md border p-4 text-sm"
    :class="notice.tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-800'
      : notice.tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-sky-200 bg-sky-50 text-sky-900'"
    role="status"
    aria-live="polite"
  >
    <p class="font-semibold">{{ notice.title }}</p>
    <p class="mt-1">{{ notice.detail }}</p>
    <button
      v-if="retryable"
      type="button"
      class="mt-3 rounded-md bg-white px-3 py-2 font-semibold shadow-sm"
      :disabled="refreshing"
      @click="emit('retry')"
    >
      Reintentar
    </button>
  </section>
</template>
