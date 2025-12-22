export default async function (fastify) {
  fastify.get('/null-output', async () => {
    // This outputs the literal string "null" to stdout
    // JSON.parse("null") returns null, and typeof null === 'object' (JS quirk)
    // This triggers the bug in #forwardThreadLog where it tries to access null.level
    console.log('null')
    return 'ok'
  })
}
