export default function setup ({ health, options, logger }) {
  const state = (globalThis.__pltExtensionHealthApi ??= {
    readiness: true,
    readinessResult: undefined,
    readinessThrow: false,
    readinessDelay: 0,
    readinessMalformed: false,
    liveness: true,
    livenessResult: undefined,
    livenessThrow: false,
    events: []
  })

  state.events.push({ event: 'setup', options })

  if (options.registerReadiness !== false) {
    state.unregisterReadiness = health.registerReadinessCheck(options.readinessName ?? 'dispatchable', async () => {
      if (state.readinessDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, state.readinessDelay))
      }

      if (state.readinessThrow) {
        throw new Error('readiness boom')
      }

      if (state.readinessMalformed) {
        return 'nope'
      }

      if (typeof state.readinessResult !== 'undefined') {
        return state.readinessResult
      }

      return state.readiness
    })
  }

  if (options.registerLiveness !== false) {
    state.unregisterLiveness = health.registerLivenessCheck(options.livenessName ?? 'control-plane', async () => {
      if (state.livenessThrow) {
        throw new Error('liveness boom')
      }

      if (typeof state.livenessResult !== 'undefined') {
        return state.livenessResult
      }

      return state.liveness
    })
  }

  if (options.registerRoutes !== false) {
    state.unregisterRoutes = health.registerRoutes(async app => {
      app.get(options.routePath ?? '/inventory', async () => {
        return { ok: true, from: options.id ?? 'extension' }
      })
    })
  }

  return {
    async close () {
      state.events.push({ event: 'close' })
      // Runtime also cleans up health contributions; explicit unregisters exercise the API.
      state.unregisterReadiness?.()
      state.unregisterLiveness?.()
      state.unregisterRoutes?.()
    }
  }
}
