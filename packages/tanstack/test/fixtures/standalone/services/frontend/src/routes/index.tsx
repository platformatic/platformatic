import { createFileRoute } from '@tanstack/react-router'

const version = 123

function Home () {
  return <div>Hello from v{version}</div>
}

export const Route = createFileRoute('/')({
  ssr: false,
  component: Home
})
