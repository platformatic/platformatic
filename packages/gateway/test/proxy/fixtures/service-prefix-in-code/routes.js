import { setBasePath } from '@platformatic/globals'

setBasePath('from-code')

export default async function (app) {
  app.get('/hello', async () => {
    return { ok: true }
  })
}
