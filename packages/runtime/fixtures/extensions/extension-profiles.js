export default function setup ({ runtime }) {
  const events = (globalThis.__pltExtensionProfileEvents ??= [])

  runtime.on('application:worker:profile:captured', payload => {
    events.push(payload)
  })

  // Enable continuous profiling on every worker as soon as it starts,
  // including replacement workers after a restart.
  runtime.on('application:worker:started', async ({ application, worker }) => {
    await runtime.startApplicationProfiling(`${application}:${worker}`, {
      type: 'cpu',
      intervalMicros: 1000,
      durationMillis: 300
    })
  })
}
