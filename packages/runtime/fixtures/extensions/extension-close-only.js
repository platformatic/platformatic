export default function setup () {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'close-only' })

  return {
    close () {
      events.push({ event: 'close', extension: 'close-only' })
    }
  }
}
