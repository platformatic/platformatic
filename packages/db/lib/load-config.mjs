import { loadConfig } from '@platformatic/service'
import ConfigManager from './config.js'

const ourConfigFiles = [
  'platformatic.db.json',
  'platformatic.db.json5',
  'platformatic.db.yaml',
  'platformatic.db.yml',
  'platformatic.db.toml',
  'platformatic.db.tml'
]

export default async function (a, b, c) {
  return loadConfig(a, b, c, ConfigManager, ourConfigFiles)
}
