'use strict'

export default async function (app) {
  app.get('/mesh', async () => {
    const response = await fetch('http://internal.plt.local/direct')
    return response.json()
  })

  app.get('/direct', async () => {
    return { ok: true }
  })
}
