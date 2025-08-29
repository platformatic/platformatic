export function initMetrics (prometheus) {
  if (!prometheus?.registry || !prometheus?.client) return null
  const { client, registry } = prometheus

  return {
    activeWsConnections: new client.Gauge({
      name: 'active_ws_gateway_connections',
      help: 'Active Websocket gateway connections in "@platformatic/gateway"',
      registers: [registry]
    })
  }
}
