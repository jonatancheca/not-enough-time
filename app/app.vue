<script setup lang="ts">
import {
  BarChart3,
  CalendarDays,
  Clock3,
  Database,
  Gauge,
  ListVideo,
  PlayCircle,
  RefreshCw,
  Settings2,
  TrendingUp,
  Trophy,
  TvMinimalPlay
} from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import type { StateNoticeContent } from '~/components/StateNotice.vue'
import { selectWatchloadViewState } from '~/lib/watchloadView'
import { formatDuration, formatHours, getVideoWindow, isWithinWindow, WATCHLOAD_WINDOWS } from '~/lib/watchload'
import {
  compareDailyCapacity,
  loadDailyCapacityMinutes,
  normalizeDailyCapacityMinutes,
  saveDailyCapacityMinutes,
  type DailyCapacityStatus
} from '~/lib/viewingCapacity'
import type { PublishedVideo, SubscribedChannel } from '~/lib/youtubeTypes'

const {
  auth,
  channelRule,
  clearAllLocalData,
  data,
  disconnectAccount,
  error,
  failedChannelIds,
  identityLoading,
  mockMode,
  refresh,
  refreshing,
  syncState,
  updateCategoryExcluded,
  updateChannelExcluded
} = useYoutubeWatchload()
const {
  connect,
  error: authError,
  reauthorize,
  status: authStatus
} = auth

const hasHydrated = ref(false)
const selectedWindow = ref<'day' | 'week' | 'month'>('month')
const capacityMinutes = ref(0)
const videoLimit = ref(10)
const channelLimit = ref(10)
const showConnectionHelp = ref(false)
const isDisconnecting = ref(false)

const isRefreshing = computed(() => hasHydrated.value && refreshing.value)
const isLoading = computed(() =>
  !hasHydrated.value || ['loading', 'authorizing'].includes(viewState.value)
)
const subscriptionsById = computed(() => {
  const entries = data.value?.subscriptions.map((channel) => [channel.id, channel] as const) ?? []
  return new Map<string, SubscribedChannel>(entries)
})
const capacityComparison = computed(() => compareDailyCapacity(
  data.value?.summary.requiredDailySeconds ?? 0,
  capacityMinutes.value
))
const viewState = computed(() => selectWatchloadViewState({
  authStatus: authStatus.value,
  mockMode,
  identityLoading: identityLoading.value,
  error: error.value,
  syncState: syncState.value,
  subscriptionCount: data.value?.subscriptions.length ?? 0,
  eligibleVideoCount: data.value?.videos.length ?? 0
}))

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

const capacityStatusLabels: Record<DailyCapacityStatus, string> = {
  sufficient: 'Capacidad suficiente',
  tight: 'Capacidad justa',
  deficit: 'Déficit de capacidad'
}

const capacityStatusClasses: Record<DailyCapacityStatus, string> = {
  sufficient: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  tight: 'border-amber-200 bg-amber-50 text-amber-800',
  deficit: 'border-red-200 bg-red-50 text-red-800'
}

const capacityStatusLabel = computed(() => capacityStatusLabels[capacityComparison.value.status])
const capacityStatusClass = computed(() => capacityStatusClasses[capacityComparison.value.status])
const capacityDifferenceMessage = computed(() => {
  const differenceSeconds = capacityComparison.value.differenceSeconds

  if (differenceSeconds > 0) {
    return `Sobran ${formatDifference(differenceSeconds)} al día`
  }

  if (differenceSeconds < 0) {
    return `Faltan ${formatDifference(differenceSeconds)} al día`
  }

  return 'Capacidad igual al ritmo requerido'
})

const visibleVideos = computed(() => {
  if (!data.value) {
    return []
  }

  return data.value.videos.filter((video) =>
    isWithinWindow(video.publishedAt, new Date(), WATCHLOAD_WINDOWS[selectedWindow.value])
  )
})
const displayedVideos = computed(() => visibleVideos.value.slice(0, videoLimit.value))
const hasMoreVideos = computed(() => displayedVideos.value.length < visibleVideos.value.length)
const displayedChannels = computed(() => data.value?.subscriptions.slice(0, channelLimit.value) ?? [])
const hasMoreChannels = computed(() =>
  displayedChannels.value.length < (data.value?.subscriptions.length ?? 0)
)
const failedChannelNames = computed(() => {
  const failedIds = new Set(failedChannelIds.value)
  return data.value?.subscriptions
    .filter((channel) => failedIds.has(channel.id))
    .map((channel) => channel.title) ?? []
})
const stateNotice = computed<StateNoticeContent | null>(() => {
  if (viewState.value === 'syncing') {
    return { tone: 'blue', title: 'Sincronizando con YouTube', detail: 'Puedes seguir usando los datos guardados mientras termina.' }
  }

  if (viewState.value === 'stale') {
    return { tone: 'amber', title: 'Datos pendientes de actualizar', detail: 'Se muestran los últimos datos guardados. Actualiza cuando tengas conexión.' }
  }

  if (viewState.value === 'partial') {
    const names = failedChannelNames.value.join(', ')
    return {
      tone: 'amber',
      title: 'Resultado parcial',
      detail: names
        ? `Faltan ${failedChannelNames.value.length} canales: ${names}. El resto de datos sigue disponible.`
        : 'Faltan algunos canales. El resto de datos sigue disponible.'
    }
  }

  if (viewState.value === 'recoverable_error') {
    return { tone: 'red', title: 'No se pudo actualizar', detail: 'Error recuperable. Comprueba la conexión y vuelve a intentarlo.' }
  }

  if (viewState.value === 'blocking_error') {
    return { tone: 'red', title: 'Sincronización bloqueada', detail: blockingErrorMessage(error.value?.kind) }
  }

  if (viewState.value === 'empty_subscriptions') {
    return { tone: 'blue', title: 'No hay suscripciones', detail: 'Suscríbete a canales en YouTube y vuelve a actualizar.' }
  }

  if (viewState.value === 'empty_eligible') {
    return { tone: 'blue', title: 'No hay vídeos elegibles', detail: 'Revisa las reglas por canal o vuelve a actualizar más tarde.' }
  }

  return null
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
      detail: 'ritmo medio de publicación',
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
    isWithinWindow(video.publishedAt, new Date(), WATCHLOAD_WINDOWS[windowKey])
  ).length
}

function channelFor(video: PublishedVideo): SubscribedChannel | undefined {
  return subscriptionsById.value.get(video.channelId)
}

function videoWindowLabel(video: PublishedVideo): string {
  const windowKey = getVideoWindow(video.publishedAt, new Date())
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

function formatCoveragePercent(value: number): string {
  return `${new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 0
  }).format(value)} %`
}

function formatDifference(seconds: number): string {
  const absoluteSeconds = Math.abs(seconds)

  if (absoluteSeconds > 0 && absoluteSeconds < 60) {
    return '< 1 min'
  }

  return formatDuration(absoluteSeconds)
}

function updateCapacity(event: Event) {
  const input = event.target as HTMLInputElement
  const normalizedMinutes = normalizeDailyCapacityMinutes(input.value)
  capacityMinutes.value = normalizedMinutes
  input.value = String(normalizedMinutes)

  if (data.value?.accountId) {
    saveDailyCapacityMinutes(data.value.accountId, normalizedMinutes)
  }
}

function refreshData() {
  void refresh()
}

function loadMoreVideos() {
  videoLimit.value += 10
}

function loadMoreChannels() {
  channelLimit.value += 10
}

async function handleDisconnect() {
  isDisconnecting.value = true

  try {
    await disconnectAccount()
  } finally {
    isDisconnecting.value = false
  }
}

async function handleClearAllData() {
  if (!window.confirm('Se borrarán preferencias, capacidad y caché local. También se desconectará YouTube.')) {
    return
  }

  await clearAllLocalData()
  capacityMinutes.value = 0
}

function blockingErrorMessage(kind?: string): string {
  if (kind === 'quota_exhausted') {
    return 'La cuota de YouTube está agotada. Espera a que se restablezca antes de reintentar.'
  }

  if (kind === 'invalid_response') {
    return 'YouTube devolvió datos no válidos. Vuelve a intentarlo más tarde.'
  }

  return error.value?.message ?? 'Los datos no están disponibles.'
}

onMounted(() => {
  hasHydrated.value = true
})

watch(
  () => data.value?.accountId,
  (accountId) => {
    if (accountId) {
      capacityMinutes.value = loadDailyCapacityMinutes(accountId)
    }
  },
  { immediate: true }
)

watch(
  [selectedWindow, () => data.value?.videos],
  () => {
    videoLimit.value = 10
  }
)

watch(
  () => data.value?.subscriptions,
  () => {
    channelLimit.value = 10
  }
)
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
          <div
            v-if="mockMode"
            class="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800"
          >
            Fixture de desarrollo
          </div>
          <button
            v-if="data"
            type="button"
            class="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            :disabled="isRefreshing"
            title="Actualizar datos de YouTube"
            @click="refreshData"
          >
            <RefreshCw class="size-4" :class="{ 'animate-spin': isRefreshing }" aria-hidden="true" />
            Actualizar
          </button>
        </div>
      </header>

      <YoutubeConnectionPanel
        v-if="!mockMode"
        :account-id="data?.accountId ?? null"
        :auth-error="authError"
        :auth-status="authStatus"
        :disconnecting="isDisconnecting"
        :show-help="showConnectionHelp"
        @close-help="showConnectionHelp = false"
        @connect="connect"
        @disconnect="handleDisconnect"
        @reauthorize="reauthorize"
        @show-help="showConnectionHelp = true"
      />

      <StateNotice
        :notice="stateNotice"
        :refreshing="isRefreshing"
        :retryable="['recoverable_error', 'stale', 'empty_subscriptions'].includes(viewState)"
        @retry="refreshData"
      />

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
            <div class="mt-5">
              <label for="daily-capacity" class="text-sm font-medium text-slate-700">
                Minutos disponibles al día
              </label>
              <div class="mt-2 flex items-center gap-3">
                <input
                  id="daily-capacity"
                  :value="capacityMinutes"
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  class="h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-lg font-semibold text-slate-950 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  aria-describedby="daily-capacity-help"
                  @change="updateCapacity"
                >
                <span class="text-sm font-medium text-slate-500">min/día</span>
              </div>
              <p id="daily-capacity-help" class="mt-2 text-xs text-slate-500">
                Se guarda en este navegador para esta cuenta.
              </p>
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
            <div class="mt-4 rounded-md border p-4" :class="capacityStatusClass" aria-live="polite">
              <p class="text-sm font-semibold">{{ capacityStatusLabel }}</p>
              <p class="mt-2 text-xl font-semibold">{{ capacityDifferenceMessage }}</p>
              <p class="mt-1 text-sm">
                Cobertura: {{ formatCoveragePercent(capacityComparison.coveragePercent) }}
              </p>
            </div>
          </aside>
        </section>

        <section
          id="channel-rules"
          class="rounded-md border border-slate-200 bg-white shadow-soft"
        >
          <div class="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-slate-950">
                <Settings2 class="size-5 text-violet-600" aria-hidden="true" />
                <h2 class="text-lg font-semibold">Suscripciones y reglas</h2>
              </div>
              <p class="mt-1 text-sm text-slate-500">
                Excluir contenido recalcula todo al instante, sin otra llamada a YouTube.
              </p>
            </div>
            <span class="text-sm text-slate-500">{{ data.subscriptions.length }} canales</span>
          </div>

          <div v-if="data.subscriptions.length" class="divide-y divide-slate-100">
            <article
              v-for="channel in displayedChannels"
              :key="channel.id"
              class="grid min-w-0 gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center"
            >
              <div class="flex min-w-0 items-center gap-3">
                <img
                  :src="channel.avatarUrl"
                  :alt="channel.title"
                  class="size-11 shrink-0 rounded-md object-cover"
                >
                <div class="min-w-0">
                  <h3 class="truncate font-semibold text-slate-950">{{ channel.title }}</h3>
                  <a
                    :href="channel.url"
                    target="_blank"
                    rel="noreferrer"
                    class="text-sm text-slate-500 hover:text-red-600"
                  >
                    Abrir canal
                  </a>
                </div>
              </div>

              <ChannelRuleControls
                :rule="channelRule(channel.id)"
                @channel-excluded="updateChannelExcluded(channel.id, $event)"
                @category-excluded="updateCategoryExcluded(
                  channel.id,
                  $event.category,
                  $event.excluded
                )"
              />
            </article>
          </div>

          <div v-else class="p-5 text-sm text-slate-600">
            No hay suscripciones que configurar.
          </div>

          <div class="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              v-if="hasMoreChannels"
              type="button"
              class="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click="loadMoreChannels"
            >
              Mostrar 10 canales más
            </button>
            <span v-else />
            <button
              type="button"
              class="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
              @click="handleClearAllData"
            >
              <Database class="size-4" aria-hidden="true" />
              Borrar datos locales
            </button>
          </div>
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
              v-for="video in displayedVideos"
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
          <div
            v-if="visibleVideos.length === 0"
            class="border-t border-slate-100 p-5 text-sm text-slate-600"
          >
            No hay vídeos elegibles en este periodo.
          </div>
          <div v-if="hasMoreVideos" class="border-t border-slate-200 p-5 text-center">
            <button
              type="button"
              class="h-10 rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click="loadMoreVideos"
            >
              Cargar 10 más
            </button>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
