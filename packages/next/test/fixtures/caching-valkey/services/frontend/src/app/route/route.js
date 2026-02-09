import { setTimeout as sleep } from 'node:timers/promises'

export const dynamic = 'force-static'
export const revalidate = 120

export async function GET (request) {
  const version = Date.now()
  let time

  const url = new URL(request.url)
  if (url.searchParams.has('delay')) {
    await sleep(parseInt(url.searchParams.get('delay'), 10))
  }

  const delay = Math.ceil((Date.now() - version) / 1000)

  try {
    const data = await fetch('http://backend.plt.local/time-alternative', {
      next: { revalidate, tags: ['first', 'second', 'third'] },
      signal: AbortSignal.timeout(1000)
    })

    if (!data.ok) {
      return Response.json({ ok: false }, { status: 404 })
    }

    time = (await data.json()).time
  } catch (e) {
    time = 0
  }

  setTimeout(() => {
    globalThis.platformatic.events.emitAndNotify('completed')
  }, 100)

  return Response.json({ delay, version, time })
}
