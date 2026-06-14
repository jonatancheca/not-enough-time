import { parseYouTubeDurationToSeconds } from './watchload'
import type { PublishedVideo, SubscribedChannel, YouTubeClient } from './youtubeTypes'

interface MockVideoSeed {
  id: string
  channelId: string
  title: string
  durationIso: string
  daysAgo: number
  hoursAgo: number
  thumbnailUrl: string
}

const channels: SubscribedChannel[] = [
  {
    id: 'dev-pragmatico',
    title: 'Dev Pragmatico',
    avatarUrl: 'https://images.unsplash.com/photo-1555952494-efd681c7e3f9?auto=format&fit=crop&w=128&q=80',
    url: 'https://www.youtube.com/@dev-pragmatico'
  },
  {
    id: 'ciencia-en-corto',
    title: 'Ciencia en Corto',
    avatarUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=128&q=80',
    url: 'https://www.youtube.com/@ciencia-en-corto'
  },
  {
    id: 'historia-visual',
    title: 'Historia Visual',
    avatarUrl: 'https://images.unsplash.com/photo-1461360228754-6e81c478b882?auto=format&fit=crop&w=128&q=80',
    url: 'https://www.youtube.com/@historia-visual'
  },
  {
    id: 'cocina-de-semana',
    title: 'Cocina de Semana',
    avatarUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=128&q=80',
    url: 'https://www.youtube.com/@cocina-de-semana'
  },
  {
    id: 'productividad-real',
    title: 'Productividad Real',
    avatarUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=128&q=80',
    url: 'https://www.youtube.com/@productividad-real'
  },
  {
    id: 'indie-games-lab',
    title: 'Indie Games Lab',
    avatarUrl: 'https://images.unsplash.com/photo-1556438064-2d7646166914?auto=format&fit=crop&w=128&q=80',
    url: 'https://www.youtube.com/@indie-games-lab'
  },
  {
    id: 'finanzas-claras',
    title: 'Finanzas Claras',
    avatarUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=128&q=80',
    url: 'https://www.youtube.com/@finanzas-claras'
  }
]

const videoSeeds: MockVideoSeed[] = [
  {
    id: 'dev-cache-2026',
    channelId: 'dev-pragmatico',
    title: 'Arquitectura limpia en un proyecto Nuxt real',
    durationIso: 'PT38M20S',
    daysAgo: 0,
    hoursAgo: 4,
    thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'science-ocean-thermal',
    channelId: 'ciencia-en-corto',
    title: 'Por que el oceano cambia el clima de una ciudad',
    durationIso: 'PT16M45S',
    daysAgo: 0,
    hoursAgo: 9,
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'kitchen-rice',
    channelId: 'cocina-de-semana',
    title: 'Tres cenas rapidas con arroz y verduras',
    durationIso: 'PT24M12S',
    daysAgo: 0,
    hoursAgo: 18,
    thumbnailUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'finance-rates',
    channelId: 'finanzas-claras',
    title: 'Como leer una cartera cuando bajan los tipos',
    durationIso: 'PT42M08S',
    daysAgo: 1,
    hoursAgo: 3,
    thumbnailUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'games-prototype',
    channelId: 'indie-games-lab',
    title: 'Analizando diez prototipos jugables en una tarde',
    durationIso: 'PT1H12M05S',
    daysAgo: 2,
    hoursAgo: 6,
    thumbnailUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'history-map',
    channelId: 'historia-visual',
    title: 'El mapa que explica una frontera imposible',
    durationIso: 'PT54M30S',
    daysAgo: 3,
    hoursAgo: 12,
    thumbnailUrl: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'prod-weekly-review',
    channelId: 'productividad-real',
    title: 'Revision semanal sin convertirla en otro trabajo',
    durationIso: 'PT28M09S',
    daysAgo: 4,
    hoursAgo: 2,
    thumbnailUrl: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'dev-testing',
    channelId: 'dev-pragmatico',
    title: 'Tests que detectan regresiones de verdad',
    durationIso: 'PT47M51S',
    daysAgo: 5,
    hoursAgo: 8,
    thumbnailUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'science-solar',
    channelId: 'ciencia-en-corto',
    title: 'La energia solar vista desde una azotea',
    durationIso: 'PT21M38S',
    daysAgo: 6,
    hoursAgo: 5,
    thumbnailUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'history-city',
    channelId: 'historia-visual',
    title: 'La ciudad que cambio de nombre cinco veces',
    durationIso: 'PT1H03M18S',
    daysAgo: 9,
    hoursAgo: 10,
    thumbnailUrl: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'kitchen-soups',
    channelId: 'cocina-de-semana',
    title: 'Sopas frias para dias largos',
    durationIso: 'PT18M44S',
    daysAgo: 11,
    hoursAgo: 15,
    thumbnailUrl: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'prod-focus',
    channelId: 'productividad-real',
    title: 'Bloques de foco que sobreviven a reuniones',
    durationIso: 'PT33M27S',
    daysAgo: 13,
    hoursAgo: 4,
    thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'finance-budget',
    channelId: 'finanzas-claras',
    title: 'Presupuesto anual explicado con tres hojas',
    durationIso: 'PT39M11S',
    daysAgo: 15,
    hoursAgo: 7,
    thumbnailUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'games-sound',
    channelId: 'indie-games-lab',
    title: 'Disenar sonido para un juego pequeno',
    durationIso: 'PT52M02S',
    daysAgo: 19,
    hoursAgo: 9,
    thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'dev-deploy',
    channelId: 'dev-pragmatico',
    title: 'Deploys previsibles con menos magia',
    durationIso: 'PT41M00S',
    daysAgo: 22,
    hoursAgo: 11,
    thumbnailUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'history-archive',
    channelId: 'historia-visual',
    title: 'Como leer un archivo fotografico',
    durationIso: 'PT35M33S',
    daysAgo: 28,
    hoursAgo: 1,
    thumbnailUrl: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'science-old',
    channelId: 'ciencia-en-corto',
    title: 'Este video queda fuera de la ventana mensual',
    durationIso: 'PT19M00S',
    daysAgo: 36,
    hoursAgo: 0,
    thumbnailUrl: 'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?auto=format&fit=crop&w=640&q=80'
  }
]

export function createMockYouTubeClient(now = new Date()): YouTubeClient {
  const videos = buildVideos(now)

  return {
    async listMySubscriptions() {
      return delay(channels)
    },
    async listRecentUploads(channelIds, publishedAfter) {
      const publishedAfterTime = new Date(publishedAfter).getTime()
      const channelSet = new Set(channelIds)

      return delay(
        videos
          .filter((video) => channelSet.has(video.channelId))
          .filter((video) => new Date(video.publishedAt).getTime() >= publishedAfterTime)
          .toSorted((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
      )
    },
    async listVideoDetails(videoIds) {
      const idSet = new Set(videoIds)

      return delay(videos.filter((video) => idSet.has(video.id)))
    }
  }
}

function buildVideos(now: Date): PublishedVideo[] {
  return videoSeeds.map((seed) => ({
    id: seed.id,
    channelId: seed.channelId,
    title: seed.title,
    publishedAt: toRelativeIso(now, seed.daysAgo, seed.hoursAgo),
    durationIso: seed.durationIso,
    durationSeconds: parseYouTubeDurationToSeconds(seed.durationIso),
    thumbnailUrl: seed.thumbnailUrl,
    url: `https://www.youtube.com/watch?v=${seed.id}`
  }))
}

function toRelativeIso(now: Date, daysAgo: number, hoursAgo: number): string {
  const publishedAt = new Date(now)
  publishedAt.setUTCDate(publishedAt.getUTCDate() - daysAgo)
  publishedAt.setUTCHours(publishedAt.getUTCHours() - hoursAgo)
  return publishedAt.toISOString()
}

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(structuredClone(value)), 140)
  })
}
