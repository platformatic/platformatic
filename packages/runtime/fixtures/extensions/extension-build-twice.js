export default async function setup () {
  return {
    async onBuild (context, build) {
      await build()
      return build()
    }
  }
}
