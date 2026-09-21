export default function setup () {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'second' })

  return {
    start () {
      events.push({ event: 'start', extension: 'second' })
    },
    stop () {
      events.push({ event: 'stop', extension: 'second' })
    },
    close () {
      events.push({ event: 'close', extension: 'second' })
    }
  }
}
