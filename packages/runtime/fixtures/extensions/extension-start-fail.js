export default function setup () {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'start-fail' })

  return {
    start () {
      events.push({ event: 'start', extension: 'start-fail' })
      throw new Error('start intentionally failed')
    },
    stop () {
      events.push({ event: 'stop', extension: 'start-fail' })
    },
    close () {
      events.push({ event: 'close', extension: 'start-fail' })
    }
  }
}
