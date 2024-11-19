module.exports = async function (app) {
  app.get('/', async (request, reply) => {
    const response = await fetch('http://service-2.plt.local')
    return await response.json()
  })
}
