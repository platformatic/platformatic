import { version } from '../schema.js'

export default {
  version: '2.0.0',
  toVersion: version,
  up (config) {
    if (typeof config.allowCycles === 'boolean') {
      delete config.allowCycles
    }

    config.$schema = `https://schemas.platformatic.dev/@platformatic/service/${version}.json`

    return config
  }
}
