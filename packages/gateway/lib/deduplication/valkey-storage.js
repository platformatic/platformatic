import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let Redis
let msgpackr

function keyFor (prefix, section, key) {
  let result = prefix?.length ? prefix + ':' : ''
  result += 'gateway:deduplication'

  if (section?.length) {
    result += ':' + section
  }

  if (key?.length) {
    result += ':' + Buffer.from(key).toString('base64url')
  }

  return result
}

function ensureRedis () {
  if (!Redis) {
    Redis = require('iovalkey').Redis
  }
}

function ensureMsgpackr () {
  if (!msgpackr) {
    msgpackr = require('msgpackr')
  }
}

function serialize (data) {
  return msgpackr.pack(data).toString('base64url')
}

function deserialize (data) {
  return msgpackr.unpack(Buffer.from(data, 'base64url'))
}

export class ValkeyDeduplicationStorage {
  #prefix
  #primary
  #secondary
  #channels
  #closed

  constructor (config = {}) {
    ensureRedis()
    ensureMsgpackr()

    this.#prefix = config.prefix
    this.#primary = new Redis(config.url, { enableAutoPipelining: true })
    this.#secondary = new Redis(config.url, { enableAutoPipelining: false })
    this.#channels = new Map()
    this.#closed = false
    this.#secondary.on('message', this.#onMessage)
  }

  async lock (key, token, ttl) {
    const result = await this.#primary.set(this.#key('locks', key), token, 'NX', 'PX', ttl)
    return result === 'OK'
  }

  async unlock (key, token) {
    const lockKey = this.#key('locks', key)
    const current = await this.#primary.get(lockKey)
    if (current === token) {
      await this.#primary.del(lockKey)
    }
  }

  async wait (key, timeout) {
    const channel = this.#key('channels', key)
    const responseId = await this.#primary.get(this.#key('responsesIds', key))
    if (responseId) {
      return responseId
    }

    const aborter = new AbortController()
    const timer = setTimeout(() => aborter.abort(), timeout).unref()
    const waiter = Promise.withResolvers()
    aborter.signal.addEventListener('abort', () => waiter.resolve(null), { once: true })
    await this.#addWaiter(channel, waiter)

    try {
      const responseId = await this.#primary.get(this.#key('responsesIds', key))
      if (responseId) {
        return responseId
      }

      return await waiter.promise
    } finally {
      clearTimeout(timer)
      await this.#removeWaiter(channel, waiter)
    }
  }

  async notify (key, responseId, ttl) {
    await this.#primary.set(this.#key('responsesIds', key), responseId, 'PX', ttl)
    await this.#primary.publish(this.#key('channels', key), responseId)
  }

  async getResponse (responseId) {
    const raw = await this.#primary.get(this.#key('responses', responseId))
    return raw ? deserialize(raw) : null
  }

  async setResponse (responseId, response, ttl) {
    await this.#primary.set(this.#key('responses', responseId), serialize(response), 'PX', ttl)
  }

  async close () {
    if (this.#closed) {
      return
    }
    this.#closed = true

    this.#secondary.off('message', this.#onMessage)

    for (const channel of this.#channels.keys()) {
      await this.#secondary.unsubscribe(channel)
    }

    this.#channels.clear()
    this.#primary.disconnect(false)
    this.#secondary.disconnect(false)
  }

  #key (section, key) {
    return keyFor(this.#prefix, section, key)
  }

  async #addWaiter (channel, waiter) {
    let entry = this.#channels.get(channel)

    if (!entry) {
      entry = { count: 0, waiters: new Set() }
      this.#channels.set(channel, entry)
      await this.#secondary.subscribe(channel)
    }

    entry.count++
    entry.waiters.add(waiter)
  }

  async #removeWaiter (channel, waiter) {
    const entry = this.#channels.get(channel)
    if (!entry) {
      return
    }

    if (entry.waiters.delete(waiter)) {
      entry.count--
    }

    if (entry.count === 0) {
      this.#channels.delete(channel)
      await this.#secondary.unsubscribe(channel)
    }
  }

  #onMessage = (channel, message) => {
    const entry = this.#channels.get(channel)
    if (!entry) {
      return
    }

    for (const waiter of entry.waiters) {
      waiter.resolve(message)
    }
  }
}
