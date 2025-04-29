export default function Home() {
  globalThis.platformatic.logger?.debug('Home page called')

  return (
    <main>
      <div>Hello World!</div>
    </main>
  )
}
