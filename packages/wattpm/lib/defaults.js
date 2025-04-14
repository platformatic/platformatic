export const defaultConfiguration = {
  server: {
    hostname: '{HOSTNAME}',
    port: '{PORT}',
  },
  logger: {
    level: 'info'
  },
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

export const defaultServiceJson = {}

export const defaultEnv = `
PORT=3042
HOSTNAME=127.0.0.1
`
