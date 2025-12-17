import type { Route } from './+types/home'

const version = 123

export function meta ({}: Route.MetaArgs) {
  return [{ title: 'New React Router App' }, { name: 'description', content: 'Welcome to React Router!' }]
}

export default function Home () {
  return <div>Hello from v{version}</div>
}
