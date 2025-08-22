export default {
  version: '1.5.0',
  up: function (config) {
    if (config.watch !== undefined) {
      delete config.watch
    }
    return config
  }
}
