import { node } from '@platformatic/node'

export default node({
  logger: {
    level: 'info',
    redact: {
      paths: ['req.headers.authorization'],
      censor: '***HIDDEN***'
    }
  }
})
