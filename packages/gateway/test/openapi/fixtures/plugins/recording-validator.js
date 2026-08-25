// Replaces the validator compiler of the instance with one that records which
// route and http part it compiles a validator for, then accepts everything.
export default async function (app) {
  globalThis.recordedValidatorCompiles = []

  app.setValidatorCompiler(({ url, httpPart }) => {
    globalThis.recordedValidatorCompiles.push(`${url} ${httpPart}`)
    return () => true
  })
}
