export default function errorHandler (error, request, reply) {
  const statusCode = error.statusCode ?? 500

  reply.status(statusCode).send({
    envelope: true,
    statusCode,
    // 5xx bodies never expose the original message.
    message: statusCode >= 500 ? 'Internal Server Error' : error.message
  })
}
