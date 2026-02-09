export default async function (app) {
  app.get('/get-level', async (request, reply) => {
    // Return the actual logger level being used
    return { level: request.log.level }
  })
}
