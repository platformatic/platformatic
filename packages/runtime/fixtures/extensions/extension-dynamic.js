import { prepareApplication } from '../../index.js'

export default function setup ({ runtime }) {
  const events = (globalThis.__pltExtensionEvents ??= [])
  const name = 'dynamic'

  events.push({ event: 'setup', extension: name })

  runtime.on('application:started', id => {
    events.push({ event: 'application:started', application: id })
  })

  return {
    async start () {
      events.push({ event: 'start', extension: name })

      const config = runtime.getRuntimeConfig(true)
      await runtime.addApplications(
        [
          await prepareApplication(config, {
            id: 'b',
            path: './services/b'
          })
        ],
        true
      )

      events.push({ event: 'dynamic-started', application: 'b' })
    },
    async stop () {
      events.push({ event: 'stop', extension: name })
    },
    async close () {
      events.push({ event: 'close', extension: name })
    }
  }
}
