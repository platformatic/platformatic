const version = 123

globalThis.platformatic.logger?.info('Log from vinext client')

export default function HomePage () {
  return <main>Hello from v{version}</main>
}
