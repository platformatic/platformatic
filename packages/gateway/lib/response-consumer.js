// Shared across separately resolved copies of the gateway in the same process.
export const proxyResponseConsumer = Symbol.for('platformatic.gateway.proxyResponseConsumer')
