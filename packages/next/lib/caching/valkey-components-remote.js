import { CacheHandler } from './valkey-components.js'

export const CACHE_HIT_METRIC = {
  name: 'next_remote_components_cache_valkey_hit_count',
  help: 'Next.js Remote Components Cache (Valkey) Hit Count'
}
export const CACHE_MISS_METRIC = {
  name: 'next_remote_components_cache_valkey_miss_count',
  help: 'Next.js Remote Components Cache (Valkey) Miss Count'
}

export const sections = {
  values: 'remote:components:values',
  tags: 'remote:components:tags'
}

export default new CacheHandler({
  configKey: 'remote',
  sections,
  cacheHitMetric: CACHE_HIT_METRIC,
  cacheMissMetric: CACHE_MISS_METRIC
})
