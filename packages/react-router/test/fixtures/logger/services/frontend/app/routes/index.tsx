import type { Route } from './+types/home'

globalThis.platformatic.logger?.info('Log from React Router App page')
const version = 123

export async function clientLoader ({ params }: Route.LoaderArgs) {
  const response = await fetch('/backend/time')
  return response.json()
}

export function meta ({}: Route.MetaArgs) {
  return [{ title: 'New React Router App' }, { name: 'description', content: 'Welcome to React Router!' }]
}

export default function Home ({ loaderData }: Route.ComponentProps) {
  const { time } = loaderData

  return (
    <div>
      Hello from v{version} t{time}
    </div>
  )
}
