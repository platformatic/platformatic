export const defaultConfiguration = {
  server: {
    hostname: '127.0.0.1',
    port: 3042
  },
  logger: {
    level: 'info'
  },
  entrypoint: '',
  autoload: {
    path: 'web'
  }
}

export const defaultPackageJson = {
  private: true,
  scripts: {
    dev: 'wattpm dev',
    build: 'wattpm build',
    start: 'wattpm start'
  },
  dependencies: {}
}
