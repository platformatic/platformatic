import { createNextConfig } from '@platformatic/next'

export default createNextConfig({
  application: {
    basePath: '/next'
  },
  logger: {
    level: 'debug'
  }
})
