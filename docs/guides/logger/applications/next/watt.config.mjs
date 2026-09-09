import { next } from '@platformatic/next'

export default next({
  application: {
    basePath: '/next'
  },
  logger: {
    level: 'debug'
  }
})
