export default async function (app) {
  const hasConfig = !!app.configureHello
  app.get('/', async req => {
    return { ...(await req.hello.get()), hasConfig }
  })
}
