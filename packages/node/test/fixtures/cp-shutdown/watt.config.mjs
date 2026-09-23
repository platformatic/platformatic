export default {
  applications: [{ id: 'frontend', path: './services/frontend' }],
  preload: './worker.js',
  logger: { level: 'warn' },
  watch: false,
  gracefulShutdown: { application: 1000, runtime: 10000 }
}
