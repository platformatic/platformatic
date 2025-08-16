import undici from 'undici'

export default function (app) {
  app.get('/request', async function () {
    try {
      const res = await undici.request('http://localhost:42')
      return await res.body.json()
    } catch (err) {
      console.log(err)
      throw err
    }
  })
}
