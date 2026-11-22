import { prepareAddedApplications } from '../../index.js'

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
      const prepared = await prepareAddedApplications(config, [{ id: 'b', path: '../services/b' }])

      await runtime.addApplications(prepared, true)

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
