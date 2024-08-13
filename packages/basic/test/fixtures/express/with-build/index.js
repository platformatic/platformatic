import express from 'express'

export function build () {
  const app = express()

  app.get('/direct', (req, res) => {
    res.send({ ok: true })
  })

  app.get('/internal', (req, res) => {
    fetch('http://main.plt.local/direct')
      .then(response => response.json())
      .then(res.json.bind(res))
  })

  return app
}
