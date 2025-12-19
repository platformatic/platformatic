import { cacheLife, cacheTag } from 'next/cache'
import { setTimeout as sleep } from 'node:timers/promises'

async function getCachedResponse (url) {
  'use cache'

  cacheLife({ revalidate: 120 })
  cacheTag('first', 'second', 'third')

  const version = Date.now()
  let time

  if (url.searchParams?.has('delay')) {
    await sleep(parseInt(url.searchParams.get('delay'), 10))
  }

  const delay = Math.ceil((Date.now() - version) / 1000)

  try {
    const data = await fetch('http://backend.plt.local/time-alternative', {
      next: { revalidate: 120, tags: ['first', 'second', 'third'] },
      signal: AbortSignal.timeout(1000)
    })

    if (!data.ok) {
      return { ok: false }
    }

    time = (await data.json()).time
  } catch (e) {
    time = 0
  }

  return { delay, version, time }
}

export async function GET (request) {
  const url = new URL(request.url)
  const response = await getCachedResponse(url)

  setTimeout(() => {
    globalThis.platformatic.events.emitAndNotify('completed')
  }, 100)

  return Response.json(response, { status: response.ok === false ? 404 : 200 })
}
