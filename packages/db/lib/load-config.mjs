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

export async function loadConfig (a, b, c) {
  if (!c) {
    c = generateConfigManagerConfig()
  } else if (c?.mergeDefaults) {
    c = { ...generateConfigManagerConfig(), ...c }
    c.mergeDefaults = false
  }

  const res = await service.loadConfig(a, b, c, 'db')
  await adjustConfig(res.configManager)
  return res
}
