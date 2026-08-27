/*
  Reports the evaluation context through settings the schema allows, so a test can tell which boot
  the loader thought it was doing without the configuration carrying keys the schema would refuse.
*/
export default ctx => ({
  applications: [],
  logger: { level: ctx.production ? 'fatal' : 'trace' },
  restartOnError: ctx.command === 'build' ? 4242 : 500
})
