export default function setup ({ runtime }) {
  const events = (globalThis.__pltExtensionProfileEvents ??= [])

  runtime.on('application:worker:profile:captured', payload => {
    events.push(payload)
  })
}
