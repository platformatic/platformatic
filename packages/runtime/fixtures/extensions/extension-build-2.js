export default async function setup () {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'build-second' })

  return {
    preBuild (context) {
      events.push({ event: 'preBuild', extension: 'build-second', context })
    },
    async onBuild (context, build) {
      events.push({ event: 'onBuild:before', extension: 'build-second', context })
      const result = await build()
      events.push({ event: 'onBuild:after', extension: 'build-second', context })
      return { ...result, second: true }
    },
    postBuild (context, result) {
      events.push({ event: 'postBuild', extension: 'build-second', context, result })
    },
    close () {
      events.push({ event: 'close', extension: 'build-second' })
    }
  }
}
