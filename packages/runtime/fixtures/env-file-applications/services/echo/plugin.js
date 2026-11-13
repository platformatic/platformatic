// Answers with the value the configuration resolved for {PLT_ENV_FILE_VALUE}
// and with the value of the same variable in the environment of the worker.
export default async function (app, options) {
  app.get('/', async () => {
    return {
      configuration: options.value,
      environment: process.env.PLT_ENV_FILE_VALUE ?? null
    }
  })
}
