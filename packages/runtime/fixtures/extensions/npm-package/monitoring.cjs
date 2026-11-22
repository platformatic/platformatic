exports.configure = function configure (config, { options }) {
  config.env = { ...config.env, CONFIGURE_NPM: options.value }
}

exports.setup = function setup () {}
