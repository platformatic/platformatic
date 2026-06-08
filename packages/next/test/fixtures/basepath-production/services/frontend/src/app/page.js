import { getBasePath } from '@platformatic/globals'
const version = 123

export default async function Home() {
  'use server'

  const result = await (await fetch('http://service.plt.local/', { cache: 'no-store' })).json()

  return (
    <code>
      {getBasePath(false)} {JSON.stringify(result.ok)}
    </code>
  )
}
