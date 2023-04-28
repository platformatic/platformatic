import service from '@platformatic/service'
import { schema } from './schema.js'
import { platformaticDB } from '../index.js'
import adjustConfig from './adjust-config.js'

export function generateConfigManagerConfig () {
  return {
    ...service.generateConfigManagerConfig(),
    schema,
    allowToWatch: ['.env'],
    envWhitelist: platformaticDB.envWhitelist
  }
}

export async function loadConfig (a, b) {
  const res = await service.loadConfig(a, b, generateConfigManagerConfig(), 'db')
  await adjustConfig(res.configManager)
  return res
}
