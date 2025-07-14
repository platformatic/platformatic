import { version } from '../schema.js'

export default {
  version: '2.0.0',
  up (config) {
    config.$schema = `https://schemas.platformatic.dev/@platformatic/composer/${version}.json`
    return config
  }
}
