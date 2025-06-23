export default async function (app) {
  app.log.info('Dynamite enabled')
  app.get('/dynamite', async () => {
    return 'Kaboom!'
  })
}
