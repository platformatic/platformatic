import Koa from 'koa'

globalThis.platformatic?.setServicePrefix('/nested/base/dir')

const app = new Koa()
const prefix = globalThis.platformatic?.basePath ?? ''

app.use(async ctx => {
  if (ctx.request.url === '/nested/base/dir/') {
    ctx.body = { production: process.env.NODE_ENV === 'production' }
  } else if (ctx.request.url === '/nested/base/dir/direct') {
    ctx.body = { ok: true }
  } else if (ctx.request.url === '/nested/base/dir/time') {
    const response = await fetch('http://backend.plt.local/time')
    ctx.body = await response.json()
  } else {
    ctx.throw(404, { ok: false })
  }
})

// This would likely fail if our code doesn't work
app.listen(1)
