<script setup lang="ts">
import {
  BarChart3,
  CalendarDays,
  Clock3,
  Gauge,
  ListVideo,
  PlayCircle,
  RefreshCw,
  TrendingUp,
  Trophy,
  TvMinimalPlay
} from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { formatDuration, formatHours, getVideoWindow, isWithinWindow, WATCHLOAD_WINDOWS } from '~/lib/watchload'
import type { PublishedVideo, SubscribedChannel } from '~/lib/youtubeTypes'

const { data, error, refresh, status } = useYoutubeWatchload()

const hasHydrated = ref(false)
const selectedWindow = ref<'day' | 'week' | 'month'>('month')

const isRefreshing = computed(() => hasHydrated.value && status.value === 'pending')
const isLoading = computed(() => !hasHydrated.value || (status.value === 'pending' && !data.value))
const generatedAt = computed(() => (data.value ? new Date(data.value.generatedAt) : new Date()))
const subscriptionsById = computed(() => {
  const entries = data.value?.subscriptions.map((channel) => [channel.id, channel] as const) ?? []
  return new Map<string, SubscribedChannel>(entries)
})

const windowOptions = [
  { key: 'month', label: '30 dias' },
  { key: 'week', label: '7 dias' },
  { key: 'day', label: '24 h' }
] as const

const windowLabels = {
  day: 'ultimas 24 h',
  week: 'ultimos 7 dias',
  month: 'ultimos 30 dias',
  older: 'fuera'
} as const

const visibleVideos = computed(() => {
  if (!data.value) {
    return []
  }

  return data.value.videos.filter((video) =>
    isWithinWindow(video.publishedAt, generatedAt.value, WATCHLOAD_WINDOWS[selectedWindow.value])
  )
})

const kpis = computed(() => {
  const summary = data.value?.summary

  return [
    {
      label: 'Ultimas 24 h',
      value: summary ? formatHours(summary.daySeconds) : '0,0 h',
      detail: `${countVideos('day')} videos`,
      icon: Clock3,
      accent: 'bg-red-500'
    },
    {
      label: 'Ultimos 7 dias',
      value: summary ? formatHours(summary.weekSeconds) : '0,0 h',
      detail: `${countVideos('week')} videos`,
      icon: CalendarDays,
      accent: 'bg-sky-500'
    },
    {
      label: 'Ultimos 30 dias',
      value: summary ? formatHours(summary.monthSeconds) : '0,0 h',
      detail: `${summary?.videoCount ?? 0} videos`,
      icon: BarChart3,
      accent: 'bg-emerald-500'
    },
    {
      label: 'Necesarias al dia',
      value: summary ? formatDuration(summary.requiredDailySeconds) : '0 min',
      detail: 'para estar al dia',
      icon: Gauge,
      accent: 'bg-amber-500'
    }
  ]
})

const averageVideoDuration = computed(() => {
  const summary = data.value?.summary

  if (!summary || summary.videoCount === 0) {
    return 0
  }

  return summary.monthSeconds / summary.videoCount
})

function countVideos(windowKey: 'day' | 'week' | 'month'): number {
  if (!data.value) {
    return 0
  }

  return data.value.videos.filter((video) =>
    isWithinWindow(video.publishedAt, generatedAt.value, WATCHLOAD_WINDOWS[windowKey])
  ).length
}

function channelFor(video: PublishedVideo): SubscribedChannel | undefined {
  return subscriptionsById.value.get(video.channelId)
}

function videoWindowLabel(video: PublishedVideo): string {
  const windowKey = getVideoWindow(video.publishedAt, generatedAt.value)
  return windowLabels[windowKey]
}

function formatPublishedAt(dateIso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateIso))
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 0,
    style: 'percent'
  }).format(value)
}

function refreshData() {
  void refresh()
}

onMounted(() => {
  hasHydrated.value = true
})
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <NuxtRouteAnnouncer />

    <main class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <header class="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex items-center gap-4">
          <div class="flex size-12 shrink-0 items-center justify-center rounded-md bg-red-600 text-white shadow-soft">
            <TvMinimalPlay class="size-7" aria-hidden="true" />
          </div>
          <div>
            <p class="text-sm font-semibold uppercase text-red-600">Not Enough Time</p>
            <h1 class="text-2xl font-semibold text-slate-950 sm:text-3xl">
              Horas publicadas por tus suscripciones
            </h1>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            Mock frontend-only
          </div>
          <button
            type="button"
            class="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            :disabled="isRefreshing"
            title="Actualizar mock"
            @click="refreshData"
          >
            <RefreshCw class="size-4" :class="{ 'animate-spin': isRefreshing }" aria-hidden="true" />
            Actualizar
          </button>
        </div>
      </header>

      <section v-if="hasHydrated && error" class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No se pudo cargar el mock de YouTube.
      </section>

      <section v-if="isLoading" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div v-for="index in 4" :key="index" class="h-36 animate-pulse rounded-md bg-white shadow-soft" />
      </section>

      <template v-else-if="data">
        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article
            v-for="kpi in kpis"
            :key="kpi.label"
            class="rounded-md border border-slate-200 bg-white p-5 shadow-soft"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-slate-500">{{ kpi.label }}</p>
                <p class="mt-2 text-3xl font-semibold text-slate-950">{{ kpi.value }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ kpi.detail }}</p>
              </div>
              <div :class="['flex size-11 items-center justify-center rounded-md text-white', kpi.accent]">
                <component :is="kpi.icon" class="size-5" aria-hidden="true" />
              </div>
            </div>
          </article>
        </section>

        <section class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div class="rounded-md border border-slate-200 bg-white shadow-soft">
            <div class="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div class="flex items-center gap-2 text-slate-950">
                  <Trophy class="size-5 text-amber-500" aria-hidden="true" />
                  <h2 class="text-lg font-semibold">Ranking por canal</h2>
                </div>
                <p class="mt-1 text-sm text-slate-500">
                  {{ data.summary.videoCount }} videos en 30 dias, media de
                  {{ formatDuration(averageVideoDuration) }}
                </p>
              </div>
              <p class="text-sm text-slate-500">
                Actualizado {{ formatPublishedAt(data.generatedAt) }}
              </p>
            </div>

            <div class="divide-y divide-slate-100">
              <article
                v-for="entry in data.summary.channelBreakdown"
                :key="entry.channel.id"
                class="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_160px]"
              >
                <div class="flex min-w-0 gap-4">
                  <img
                    :src="entry.channel.avatarUrl"
                    :alt="entry.channel.title"
                    class="size-12 shrink-0 rounded-md object-cover"
                  >
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="truncate text-base font-semibold text-slate-950">{{ entry.channel.title }}</h3>
                      <span class="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {{ entry.videoCount }} videos
                      </span>
                    </div>
                    <p class="mt-1 truncate text-sm text-slate-500">
                      Ultimo: {{ entry.latestVideo?.title ?? 'Sin videos recientes' }}
                    </p>
                    <div class="mt-3 h-2 rounded-full bg-slate-100">
                      <div
                        class="h-full rounded-full bg-red-500"
                        :style="{ width: `${Math.max(entry.shareOfMonth * 100, 3)}%` }"
                      />
                    </div>
                  </div>
                </div>
                <div class="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
                  <p class="text-xl font-semibold text-slate-950">{{ formatHours(entry.monthSeconds) }}</p>
                  <p class="text-sm text-slate-500">{{ formatPercent(entry.shareOfMonth) }} del mes</p>
                </div>
              </article>
            </div>
          </div>

          <aside class="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
            <div class="flex items-center gap-2 text-slate-950">
              <TrendingUp class="size-5 text-emerald-500" aria-hidden="true" />
              <h2 class="text-lg font-semibold">Carga diaria</h2>
            </div>
            <dl class="mt-5 grid grid-cols-2 gap-3">
              <div class="rounded-md bg-slate-50 p-4">
                <dt class="text-sm text-slate-500">Canales activos</dt>
                <dd class="mt-2 text-2xl font-semibold text-slate-950">
                  {{ data.summary.channelBreakdown.length }}
                </dd>
              </div>
              <div class="rounded-md bg-slate-50 p-4">
                <dt class="text-sm text-slate-500">Video medio</dt>
                <dd class="mt-2 text-2xl font-semibold text-slate-950">
                  {{ formatDuration(averageVideoDuration) }}
                </dd>
              </div>
            </dl>
            <div class="mt-5 rounded-md bg-slate-950 p-5 text-white">
              <div class="flex items-center gap-2">
                <Gauge class="size-5 text-amber-300" aria-hidden="true" />
                <p class="text-sm font-medium text-slate-300">Ritmo necesario</p>
              </div>
              <p class="mt-3 text-3xl font-semibold">
                {{ formatDuration(data.summary.requiredDailySeconds) }}/dia
              </p>
              <p class="mt-2 text-sm text-slate-300">
                Basado en {{ formatHours(data.summary.monthSeconds) }} publicadas durante los ultimos 30 dias.
              </p>
            </div>
          </aside>
        </section>

        <section class="rounded-md border border-slate-200 bg-white shadow-soft">
          <div class="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex items-center gap-2 text-slate-950">
              <ListVideo class="size-5 text-sky-500" aria-hidden="true" />
              <h2 class="text-lg font-semibold">Videos recientes</h2>
            </div>

            <div class="grid grid-cols-3 rounded-md border border-slate-200 bg-slate-50 p-1">
              <button
                v-for="option in windowOptions"
                :key="option.key"
                type="button"
                class="h-9 rounded-md px-3 text-sm font-semibold transition"
                :class="selectedWindow === option.key ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950'"
                @click="selectedWindow = option.key"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="divide-y divide-slate-100">
            <article
              v-for="video in visibleVideos"
              :key="video.id"
              class="grid gap-4 p-5 md:grid-cols-[180px_minmax(0,1fr)_160px]"
            >
              <img
                :src="video.thumbnailUrl"
                :alt="video.title"
                class="aspect-video w-full rounded-md object-cover md:w-[180px]"
              >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
                    {{ videoWindowLabel(video) }}
                  </span>
                  <span class="text-sm text-slate-500">{{ formatPublishedAt(video.publishedAt) }}</span>
                </div>
                <h3 class="mt-2 text-base font-semibold text-slate-950">{{ video.title }}</h3>
                <p class="mt-1 text-sm text-slate-500">{{ channelFor(video)?.title }}</p>
              </div>
              <div class="flex items-center justify-between gap-4 md:flex-col md:items-end md:justify-center">
                <div class="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                  <PlayCircle class="size-4 text-red-500" aria-hidden="true" />
                  {{ formatDuration(video.durationSeconds) }}
                </div>
                <a
                  :href="video.url"
                  target="_blank"
                  rel="noreferrer"
                  class="text-sm font-semibold text-slate-500 transition hover:text-red-600"
                >
                  Ver en YouTube
                </a>
              </div>
            </article>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
