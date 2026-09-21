export default function setup ({ runtime }) {
  const events = (globalThis.__pltExtensionHealthEvents ??= [])

  runtime.on('application:worker:health:metrics', payload => {
    events.push(payload)
  })
}
