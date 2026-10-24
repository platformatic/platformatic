import { createNodeConfig } from '@platformatic/node'

export default createNodeConfig({
  logger: {
    level: 'info',
    redact: {
      paths: ['req.headers.authorization'],
      censor: '***HIDDEN***'
    }
  }
})
