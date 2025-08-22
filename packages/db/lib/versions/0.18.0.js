export default {
  version: '0.18.0',
  up (config) {
    config.db = config.core
    delete config.core
    return config
  }
}
