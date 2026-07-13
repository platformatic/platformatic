export default function setup () {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'second' })

  return {
    close () {
      events.push({ event: 'close', extension: 'second' })
    }
  }
}
