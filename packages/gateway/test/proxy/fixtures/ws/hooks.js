import { getEvents } from '@platformatic/globals'
export default {
  onIncomingMessage: (context, source, target, { data, binary }) => {
    const events = getEvents()
    events.emit('proxy:onIncomingMessage')
  },
  onOutgoingMessage: (context, source, target, { data, binary }) => {
    const events = getEvents()
    events.emit('onOutgoingMessage')
  },
  onConnect: (context, source, target) => {
    const events = getEvents()
    events.emit('onConnect')
  },
  onDisconnect: (context, source) => {
    const events = getEvents()
    events.emit('onDisconnect')
  },
  onReconnect: (context, source, target) => {
    const events = getEvents()
    events.emit('onReconnect')
  },
  onPong: (context, source, target) => {
    const events = getEvents()
    events.emit('onPong')
  }
}
