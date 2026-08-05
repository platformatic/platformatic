export default async function setup () {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'build-first' })

  return {
    preBuild (context) {
      events.push({ event: 'preBuild', extension: 'build-first', context })
    },
    async onBuild (context, build) {
      events.push({ event: 'onBuild:before', extension: 'build-first', context })
      const result = await build()
      events.push({ event: 'onBuild:after', extension: 'build-first', context })
      return { ...result, first: true }
    },
    postBuild (context, result) {
      events.push({ event: 'postBuild', extension: 'build-first', context, result })
    },
    close () {
      events.push({ event: 'close', extension: 'build-first' })
    }
  }
}
