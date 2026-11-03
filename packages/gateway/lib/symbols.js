// Shared across separately resolved copies of the gateway in the same process.
export const kGatewayProxyResponseConsumer = Symbol.for('platformatic.gateway.proxyResponseConsumer')
