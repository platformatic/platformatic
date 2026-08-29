import { gateway } from '@platformatic/gateway'

export default gateway({
  server: {
    hostname: process.env.HOSTNAME ?? '127.0.0.1',
    port: Number(process.env.PORT ?? 3042)
  },
  gateway: {
    applications: [
      {
        id: 'next',
        proxy: {
          prefix: '/'
        }
      },
      {
        id: 'backend',
        proxy: {
          prefix: '/api'
        }
      }
    ]
  }
})
