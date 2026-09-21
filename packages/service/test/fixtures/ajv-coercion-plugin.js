export default async function (app) {
  // `capacity` allows `number | null`. With Fastify's default Ajv coercion an
  // empty string (which is not a valid number) is coerced to `null` before
  // validation, so `{ "capacity": "" }` is silently accepted as `null`.
  app.post(
    '/echo',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            capacity: { type: ['number', 'null'] }
          }
        }
      }
    },
    async request => ({ capacity: request.body.capacity })
  )
}
