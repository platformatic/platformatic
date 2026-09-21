export default function setup ({ health }) {
  const state = (globalThis.__pltExtensionReadyOnly ??= {
    readiness: true
  })

  health.registerReadinessCheck('ready-only', async () => state.readiness)
}
