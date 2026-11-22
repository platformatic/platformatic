export default {
  applications: [
    { id: 'backend', path: './services/backend' },
    { id: 'frontend', path: './services/frontend', dependencies: ['backend'] }
  ],
  watch: false,
  restartOnError: false,
  logger: { level: 'warn' },
  gracefulShutdown: { application: 5000 }
}
