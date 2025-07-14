import { version } from '../schema.js'

export default {
  version: '2.0.0',
  up: function (config) {
    config.$schema = `https://schemas.platformatic.dev/@platformatic/db/${version}.json`
    return config
  }
}
