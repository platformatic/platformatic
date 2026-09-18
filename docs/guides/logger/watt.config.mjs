import { createWattConfig } from 'wattpm'

export default createWattConfig({
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
