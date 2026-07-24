export default {
  version: '3.99.0',
  up (config) {
    delete config.entrypoint
    delete config.server

    return config
  }
}
