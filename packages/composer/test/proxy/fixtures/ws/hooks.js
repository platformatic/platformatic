module.exports = {
  onIncomingMessage: (context, source, target, { data, binary }) => {
    context.log.info('onIncomingMessage')
  },
  onOutgoingMessage: (context, source, target, { data, binary }) => {
    context.log.info('onOutgoingMessage')
  },
  onConnect: (context, source, target) => {
    context.log.info('onConnect')
  },
  onDisconnect: (context, source) => {
    context.log.info('onDisconnect')
  },
  onReconnect: (context, source, target) => {
    context.log.info('onReconnect')
  },
  onPong: (context, source, target) => {
    context.log.info('onPong')
  }
}
