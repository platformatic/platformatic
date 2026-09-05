import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    level: 'info',
    timestamp: 'isoTime',
    formatters: {
      path: 'logger-formatters.js'
    }
  },
  autoload: {
    path: 'applications'
  }
})
