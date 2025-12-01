import { createFileRoute } from '@tanstack/react-router'

const version = 123

export async function loader () {
  const response = await fetch('http://backend.plt.local/time')
  const { time } = await response.json()

  return { time }
}

function Home () {
  const { time } = Route.useLoaderData()

  return (
    <div>
      Hello from v{version} t{time}
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
  loader
})
