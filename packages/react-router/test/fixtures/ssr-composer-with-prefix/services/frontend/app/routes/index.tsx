import type { Route } from './+types/home'

const version = 123

export async function loader ({ params }: Route.LoaderArgs) {
  const response = await fetch('http://backend.plt.local/time')
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
