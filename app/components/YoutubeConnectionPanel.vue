<script setup lang="ts">
import { Info, KeyRound, LogOut, RefreshCw } from '@lucide/vue'
import { computed } from 'vue'
import type { YouTubeAuthStatus } from '~/lib/youtubeAuth'

const props = defineProps<{
  accountId: string | null
  authError: string | null
  authStatus: YouTubeAuthStatus
  disconnecting: boolean
  showHelp: boolean
}>()

const emit = defineEmits<{
  closeHelp: []
  connect: []
  disconnect: []
  reauthorize: []
  showHelp: []
}>()

const statusLabels: Record<YouTubeAuthStatus, string> = {
  disconnected: 'Desconectado',
  requesting: 'Solicitando permiso',
  connected: 'Conectado',
  expired: 'Token caducado',
  denied: 'Permiso denegado',
  revoked: 'Permiso revocado',
  missing_configuration: 'Configuración ausente'
}

const showOnboarding = computed(() => props.authStatus !== 'connected' || props.showHelp)
const canConnect = computed(() => ['disconnected', 'denied', 'revoked'].includes(props.authStatus))
const canReauthorize = computed(() => props.authStatus === 'expired')
const canManageConnection = computed(() => ['connected', 'expired'].includes(props.authStatus))
const isRequesting = computed(() => props.authStatus === 'requesting')
</script>

<template>
  <section
    v-if="showOnboarding"
    class="rounded-md border border-slate-200 bg-white p-4 shadow-soft"
    aria-labelledby="youtube-authorization-title"
    :aria-busy="isRequesting"
  >
    <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <KeyRound class="size-5 text-red-600" aria-hidden="true" />
          <h2 id="youtube-authorization-title" class="font-semibold text-slate-950">
            Acceso de solo lectura a YouTube
          </h2>
          <span
            class="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
            aria-live="polite"
          >
            {{ statusLabels[authStatus] }}
          </span>
        </div>
        <p class="mt-2 text-sm text-slate-600">
          Not Enough Time consulta tus suscripciones y la duración de sus publicaciones recientes
          para calcular la carga de publicación. No consulta historial de reproducción ni modifica tu cuenta.
        </p>
        <ul class="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <li class="rounded-md bg-slate-50 p-3">Permiso solicitado: solo lectura de YouTube.</li>
          <li class="rounded-md bg-slate-50 p-3">Token solo en memoria; desaparece al recargar.</li>
          <li class="rounded-md bg-slate-50 p-3">Preferencias guardadas solo en este navegador.</li>
          <li class="rounded-md bg-slate-50 p-3">Uso personal y con usuarios de prueba autorizados.</li>
        </ul>
        <p
          v-if="authStatus === 'missing_configuration'"
          class="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900"
          role="status"
        >
          Falta configurar el Google OAuth Client ID para este sitio.
        </p>
        <p v-if="authError" class="mt-2 text-sm font-medium text-red-700" role="alert">
          {{ authError }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-if="canConnect || authStatus === 'missing_configuration' || isRequesting"
          type="button"
          class="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="authStatus === 'missing_configuration' || isRequesting"
          @click="emit('connect')"
        >
          <RefreshCw v-if="isRequesting" class="size-4 animate-spin" aria-hidden="true" />
          <KeyRound v-else class="size-4" aria-hidden="true" />
          {{ isRequesting ? 'Solicitando permiso' : 'Conectar cuenta' }}
        </button>

        <button
          v-if="canReauthorize"
          type="button"
          class="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
          @click="emit('reauthorize')"
        >
          <RefreshCw class="size-4" aria-hidden="true" />
          Volver a autorizar
        </button>

        <button
          v-if="canManageConnection"
          type="button"
          class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          :disabled="disconnecting"
          @click="emit('disconnect')"
        >
          <LogOut class="size-4" aria-hidden="true" />
          {{ disconnecting ? 'Desconectando' : 'Desconectar' }}
        </button>

        <button
          v-if="authStatus === 'connected' && showHelp"
          type="button"
          class="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          @click="emit('closeHelp')"
        >
          Cerrar ayuda
        </button>
      </div>
    </div>
  </section>

  <section
    v-else
    class="flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="min-w-0">
      <p class="font-semibold text-emerald-900">Cuenta de YouTube conectada</p>
      <p class="mt-1 text-sm text-emerald-800">
        Permiso de solo lectura. Identidad: {{ accountId ?? 'cargando' }}.
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-900"
        @click="emit('showHelp')"
      >
        <Info class="size-4" aria-hidden="true" />
        Cómo funciona
      </button>
      <button
        type="button"
        class="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-900 disabled:opacity-60"
        :disabled="disconnecting"
        @click="emit('disconnect')"
      >
        <LogOut class="size-4" aria-hidden="true" />
        Desconectar
      </button>
    </div>
  </section>
</template>
