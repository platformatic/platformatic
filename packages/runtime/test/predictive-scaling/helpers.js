import { finalizeConfiguration } from '../../lib/config.js'

export async function createWorkersConfig (workers = {}) {
  const config = { workers, watch: false }
  await finalizeConfiguration(config, [], {}, false)
  return config.workers
}
