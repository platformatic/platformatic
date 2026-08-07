export default function setup ({ health, options }) {
  health.registerReadinessCheck(options.readinessName ?? 'second-ready', async () => {
    const state = globalThis.__pltExtensionHealthSecond ?? { readiness: true }
    return state.readiness
  })

  health.registerLivenessCheck(options.livenessName ?? 'second-live', async () => {
    const state = globalThis.__pltExtensionHealthSecond ?? { liveness: true }
    return state.liveness
  })

  if (options.registerRoutes !== false) {
    health.registerRoutes(async app => {
      app.get(options.routePath ?? '/second-inventory', async () => ({ ok: true, from: 'second' }))
    })
  }
}
