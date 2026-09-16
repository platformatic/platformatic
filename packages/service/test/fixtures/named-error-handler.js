export function errorHandler (error, request, reply) {
  reply.status(error.statusCode ?? 500).send({ envelope: 'named' })
}
