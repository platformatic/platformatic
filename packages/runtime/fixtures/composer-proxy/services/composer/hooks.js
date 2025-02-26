'use strict'

const hooks = {
  onConnect: (context, source, target) => {
    context.log.info('onConnect')
  },
  onDisconnect: (context, source, target) => {
    context.log.info('onDisconnect')
  },
  onReconnect: (context, source, target) => {
    context.log.info('onReconnect')
  },
  onIncomingMessage: (context, source, target, message) => {
    context.log.info('onIncomingMessage', message.data.toString(), message.binary)
  },
  onOutgoingMessage: (context, source, target, message) => {
    context.log.info('onOutgoingMessage', message.data.toString(), message.binary)
  }
}

module.exports = hooks
