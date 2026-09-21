export default function setup ({ runtime }) {
  const events = (globalThis.__pltExtensionEvents ??= [])
  const name = 'tracker'

  events.push({ event: 'setup', extension: name })

  runtime.on('application:started', id => {
    events.push({ event: 'application:started', application: id })
  })

  runtime.on('application:stopped', id => {
    events.push({ event: 'application:stopped', application: id })
  })

  return {
    async start () {
      events.push({ event: 'start', extension: name })
    },
    async stop () {
      events.push({ event: 'stop', extension: name })
    },
    async close () {
      events.push({ event: 'close', extension: name })
    }
  }
}
