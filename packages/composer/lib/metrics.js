export function initMetrics (prometheus) {
  if (!prometheus?.registry || !prometheus?.client) return null
  const { client, registry } = prometheus

  return {
    activeWsConnections: new client.Gauge({
      name: 'active_ws_composer_connections',
      help: 'Active Websocket composer connections in "@platformatic/composer"',
      registers: [registry]
    })
  }
}
