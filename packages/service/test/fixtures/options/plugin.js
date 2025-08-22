'use default'

module.exports = async function (app, opts) {
  app.get('/', async () => {
    return opts
  })
}
