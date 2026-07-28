export async function setup ({ options }) {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'named-setup', options })

  return {
    start () {
      events.push({ event: 'start', extension: 'named-setup' })
    },
    stop () {
      events.push({ event: 'stop', extension: 'named-setup' })
    },
    close () {
      events.push({ event: 'close', extension: 'named-setup' })
    }
  }
}
