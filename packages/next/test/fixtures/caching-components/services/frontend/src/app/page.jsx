import { cacheLife, cacheTag } from 'next/cache'
import { notFound } from 'next/navigation'

export default async function Home () {
  'use cache'

  cacheLife({ revalidate: 120 })
  cacheTag('first', 'second', 'third')

  const version = Date.now()
  let time = 1

  try {
    const data = await fetch('http://backend.plt.local/time')

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
