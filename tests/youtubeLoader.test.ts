import { describe, expect, it, vi } from 'vitest'
import { createYouTubeSnapshotLoader, loadYouTubeAccountId } from '../app/lib/youtubeLoader'
import type { PublishedVideo, SubscribedChannel, YouTubeClient } from '../app/lib/youtubeTypes'

const subscriptions: SubscribedChannel[] = [
  channel('alpha'),
  channel('beta')
]

describe('YouTube snapshot loader', () => {
  it('uses the authorized YouTube channel ID as stable account identity', async () => {
    const client = fakeClient()
    const controller = new AbortController()

    await expect(loadYouTubeAccountId(client, controller.signal)).resolves.toBe('owner-channel-id')
    expect(client.getMyChannelId).toHaveBeenCalledWith({ signal: controller.signal })
  })

  it('keeps successful channels when another channel fails', async () => {
    const client = fakeClient()
    vi.mocked(client.listRecentUploads).mockImplementation(async ([channelId]) => {
      if (channelId === 'beta') {
        throw new Error('beta failed')
      }

      return [{ id: 'alpha-video', channelId: 'alpha', publishedAt: '2026-09-18T12:00:00.000Z' }]
    })
    vi.mocked(client.listVideoDetails).mockResolvedValue([video('alpha-video', 'alpha')])
    const load = createYouTubeSnapshotLoader({
      getClient: () => client,
      now: () => new Date('2026-09-19T12:00:00.000Z')
    })

    const result = await load({
      accountId: 'owner-channel-id',
      previous: null,
      signal: new AbortController().signal
    })

    expect(result.subscriptions).toEqual(subscriptions)
    expect(result.channels[0]).toEqual({ channelId: 'alpha', videos: [video('alpha-video', 'alpha')] })
    expect(result.channels[1]).toMatchObject({ channelId: 'beta', error: expect.any(Error) })
  })

  it('retries selected channels without reloading subscriptions', async () => {
    const client = fakeClient()
    const load = createYouTubeSnapshotLoader({ getClient: () => client })
    const previous = {
      version: 1 as const,
      accountId: 'owner-channel-id',
      subscriptions,
      videos: [],
      channelUpdatedAt: {},
      updatedAt: '2026-09-19T12:00:00.000Z',
      lastCompleteSyncAt: null,
      failedChannelIds: ['beta']
    }

    const result = await load({
      accountId: 'owner-channel-id',
      previous,
      signal: new AbortController().signal,
      channelIds: ['beta']
    })

    expect(client.listMySubscriptions).not.toHaveBeenCalled()
    expect(client.listRecentUploads).toHaveBeenCalledTimes(1)
    expect(result.subscriptions).toBeUndefined()
    expect(result.channels).toEqual([{ channelId: 'beta', videos: [] }])
  })
})

function fakeClient(): YouTubeClient {
  return {
    getMyChannelId: vi.fn(async () => 'owner-channel-id'),
    listMySubscriptions: vi.fn(async () => subscriptions),
    listRecentUploads: vi.fn(async () => []),
    listVideoDetails: vi.fn(async () => [])
  }
}

function channel(id: string): SubscribedChannel {
  return {
    id,
    title: id,
    avatarUrl: `https://example.com/${id}.jpg`,
    url: `https://www.youtube.com/channel/${id}`
  }
}

function video(id: string, channelId: string): PublishedVideo {
  return {
    id,
    channelId,
    title: id,
    publishedAt: '2026-09-18T12:00:00.000Z',
    durationIso: 'PT10M',
    durationSeconds: 600,
    thumbnailUrl: `https://example.com/${id}.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
    liveStatus: 'none'
  }
}
