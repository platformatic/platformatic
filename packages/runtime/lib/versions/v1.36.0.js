export default {
  version: '1.36.0',
  up: function (config) {
    if (config.restartOnError === undefined) {
      config.restartOnError = false
    }
    return config
  }
}
