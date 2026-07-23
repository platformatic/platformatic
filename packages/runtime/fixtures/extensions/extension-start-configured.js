export default function setup ({ runtime }) {
  const events = (globalThis.__pltExtensionEvents ??= [])
  const name = 'start-configured'

  events.push({ event: 'setup', extension: name })

  runtime.on('application:started', id => {
    events.push({ event: 'application:started', application: id })
  })

  return {
    async start () {
      events.push({ event: 'start', extension: name })
      // Start the originally configured application from the extension start hook.
      // The normal startup pass must not start it a second time.
      await runtime.startApplication('a')
      events.push({ event: 'started-configured', application: 'a' })
    },
    async stop () {
      events.push({ event: 'stop', extension: name })
    },
    async close () {
      events.push({ event: 'close', extension: name })
    }
  }
}
