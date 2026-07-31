export default async function setup ({ options }) {
  const { name } = options

  function record (event, context, hook = event) {
    globalThis.__pltExtensionEvents.push({ event, extension: name, context })

    const failure = globalThis.__pltExtensionFailure
    if (failure?.extension === name && failure.hook === hook) {
      throw new Error(`${hook} failure from ${name}`)
    }
  }

  return {
    preBuild (context) {
      record('preBuild', context)
    },
    async onBuild (context, build) {
      record('onBuild:before', context, 'onBuild')
      const result = await build()
      record('onBuild:after', context)
      return result
    },
    postBuild (context) {
      record('postBuild', context)
    }
  }
}
