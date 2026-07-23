export default function createCustomPreValidation () {
  return {
    async preValidation (request, reply) {
      if (request.headers['x-plt-intercept'] === 'true') {
        return reply.code(418).send({ intercepted: true })
      }
    }
  }
}
