const version = 123

export default async function Home() {
  'use server'
  return <div>Hello from v{version}</div>
}
