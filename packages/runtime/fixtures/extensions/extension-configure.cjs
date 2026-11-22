module.exports = {
  __esModule: true,
  configure (config, { options }) {
    config.env = { ...config.env, CONFIGURE_CJS: options.value }
  },
  setup () {}
}
