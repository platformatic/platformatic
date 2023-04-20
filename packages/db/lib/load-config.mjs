import service from '@platformatic/service'
import { schema } from './schema.js'
import { platformaticDB } from '../index.js'
import adjustConfig from './adjust-config.js'

const ourConfigFiles = [
  'platformatic.db.json',
  'platformatic.db.json5',
  'platformatic.db.yaml',
  'platformatic.db.yml',
  'platformatic.db.toml',
  'platformatic.db.tml'
]

export function generateConfigManagerConfig () {
  return {
    ...service.generateConfigManagerConfig(),
    schema,
    allowToWatch: ['.env'],
    envWhitelist: platformaticDB.envWhitelist
  }
}

export async function loadConfig (a, b) {
  const res = await service.loadConfig(a, b, generateConfigManagerConfig(), ourConfigFiles)
  await adjustConfig(res.configManager)
  return res
}
