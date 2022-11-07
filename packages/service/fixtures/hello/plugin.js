'use default'

module.exports = async function (app) {
  app.get('/', async () => {
    return { hello: 'world' }
  })
}
