import { getEvents } from '@platformatic/globals'
import { env as globalEnv } from 'cloudflare:workers'

export default {
  async fetch (request, env, ctx) {
    const url = new URL(request.url)

    switch (url.pathname) {
      case '/env':
        return Response.json({
          greeting: env.GREETING,
          secret: env.SECRET,
          fromWatt: env.FROM_WATT,
          sameEnv: env === globalEnv
        })
      case '/echo':
        return new Response(await request.text(), {
          status: 201,
          headers: { 'content-type': request.headers.get('content-type'), 'x-method': request.method }
        })
      case '/cookies': {
        const headers = new Headers()
        headers.append('set-cookie', 'a=1')
        headers.append('set-cookie', 'b=2')
        return new Response('ok', { headers })
      }
      case '/binding':
        return env.BACKEND.fetch(new Request('https://ignored.example.com/from-binding'))
      case '/mesh':
        return fetch('http://backend.plt.local/from-mesh')
      case '/wait-until':
        ctx.waitUntil(Promise.resolve())
        return new Response('waited')
      case '/error':
        throw new Error('kaboom')
      default:
        return new Response('Not Found', { status: 404 })
    }
  },

  async scheduled (controller, env) {
    getEvents().emitAndNotify('scheduled', controller.cron, typeof controller.scheduledTime, env.GREETING)
  }
}
