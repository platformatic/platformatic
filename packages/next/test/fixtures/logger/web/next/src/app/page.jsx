import { notFound } from 'next/navigation'

export const revalidate = 120

export default async function Home() {
  globalThis.platformatic.logger?.info({ secret: '1234567890' }, 'Home page called')

  const version = Date.now()
  let time

  try {
    const data = await fetch('http://backend.plt.local/time', {
      next: { revalidate, tags: ['first', 'second', 'third'] },
      signal: AbortSignal.timeout(1000)
    })

    if (!data.ok) {
      notFound()
    }

    time = (await data.json()).time
  } catch (e) {
    time = 0
  }

  return (
    <div>
      Hello from v{version} t{time}
    </div>
  )
}
