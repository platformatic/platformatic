const { tracingChannel } = require('node:diagnostics_channel')

// This channel is used to set the dummy port, it should result in a EADDRINUSE error
const subscribers = {
  asyncStart ({ options }) {
    if (options.port === 0) {
      options.port = parseInt(process.env.DUMMY_PORT, 10)
    }

    tracingChannel('net.server.listen').unsubscribe(subscribers)
  }
}

tracingChannel('net.server.listen').subscribe(subscribers)

module.exports = async function (app) {
  app.get('/', async () => {
    return { hello: 'world' }
  })
}
