// Shared across separately resolved copies of the gateway in the same process.
export const kGatewayProxyResponseHandler = Symbol.for('platformatic.gateway.proxyResponseHandler')
