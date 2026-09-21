import { abstractLogger } from '@platformatic/foundation'
import { getMessaging, removeGlobals, updateGlobals } from '@platformatic/globals'
import { MessageChannel } from 'node:worker_threads'
import { MessagingITC } from './worker/messaging.js'

class LoopbackMessagingITC extends MessagingITC {
  #application
  #channel

  constructor (id, application, runtimeConfig, logger, channel) {
    super(id, runtimeConfig, logger)

    this.#application = application
    this.#channel = channel
    this.addSource(channel)
  }

  // Force the next worker to be the channel
  _getNextWorker () {
    return { application: this.#application, channel: this.#channel }
  }
}

class LoopbackMessaging extends LoopbackMessagingITC {
  #target
  #channel
  #previousGlobals

  constructor (targetId, config, logger) {
    const channel = new MessageChannel()

    super('loopback-messaging', targetId, config, logger, channel.port1)
    this.#channel = channel
    this.#target = new LoopbackMessagingITC(targetId, 'loopback-messaging', config, logger, channel.port2)
  }

  mount () {
    this.#previousGlobals = getMessaging({ throwOnMissing: false })

    updateGlobals({
      messaging: {
        handle: this.#target.handle.bind(this.#target),
        send: this.#target.send.bind(this.#target),
        notify: this.#target.notify.bind(this.#target)
      }
    })

    return this
  }

  unmount () {
    if (this.#previousGlobals) {
      updateGlobals({ messaging: this.#previousGlobals })
    } else {
      removeGlobals(['messaging'])
    }

    this.close()
    this.#target.close()
    this.#channel.port1.close()
    this.#channel.port2.close()
  }
}

export function setupLoopbackMessaging (targetId, options) {
  options ??= {}

  const runtimeConfig = { ...(options.runtimeConfig ?? {}) }
  runtimeConfig.messagingTimeout ??= 5000

  const messaging = new LoopbackMessaging(targetId, runtimeConfig, options.logger ?? abstractLogger)

  if (options.mount !== false) {
    messaging.mount()
  }

  return messaging
}
