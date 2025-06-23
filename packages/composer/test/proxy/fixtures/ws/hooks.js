module.exports = {
  onIncomingMessage: (context, source, target, { data, binary }) => {
    globalThis.platformatic.events.emit('proxy:onIncomingMessage')
  },
  onOutgoingMessage: (context, source, target, { data, binary }) => {
    globalThis.platformatic.events.emit('onOutgoingMessage')
  },
  onConnect: (context, source, target) => {
    globalThis.platformatic.events.emit('onConnect')
  },
  onDisconnect: (context, source) => {
    globalThis.platformatic.events.emit('onDisconnect')
  },
  onReconnect: (context, source, target) => {
    globalThis.platformatic.events.emit('onReconnect')
  },
  onPong: (context, source, target) => {
    globalThis.platformatic.events.emit('onPong')
  }
}
