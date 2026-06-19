export function initMetrics (prometheus) {
  if (!prometheus?.registry || !prometheus?.client) return null
  const { client, registry } = prometheus

  return {
    activeWsConnections: new client.Gauge({
      name: 'active_ws_gateway_connections',
      help: 'Active Websocket gateway connections in "@platformatic/gateway"',
      registers: [registry]
    }),
    deduplicationLeader: new client.Counter({
      name: 'gateway_deduplication_leader_count',
      help: 'Number of gateway deduplication leader requests',
      registers: [registry]
    }),
    deduplicationWaiter: new client.Counter({
      name: 'gateway_deduplication_waiter_count',
      help: 'Number of gateway deduplication waiting requests',
      registers: [registry]
    }),
    deduplicationReplay: new client.Counter({
      name: 'gateway_deduplication_replay_count',
      help: 'Number of gateway deduplication replayed responses',
      registers: [registry]
    }),
    deduplicationFallback: new client.Counter({
      name: 'gateway_deduplication_fallback_count',
      help: 'Number of gateway deduplication fallback requests',
      registers: [registry]
    }),
    deduplicationError: new client.Counter({
      name: 'gateway_deduplication_error_count',
      help: 'Number of gateway deduplication errors',
      registers: [registry]
    })
  }
}
