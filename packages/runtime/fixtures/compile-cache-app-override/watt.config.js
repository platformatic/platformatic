export default {
  compileCache: {
    enabled: true,
    awaitFirstWorker: true
  },
  applications: [
    {
      id: 'a',
      path: './services/a',
      compileCache: {
        enabled: true
      }
    }
  ],
  logger: {
    level: 'error'
  }
}
