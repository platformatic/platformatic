import { CircularBuffer, LRUCacheWithDelete as LRUCache } from 'mnemonist'
import { resolveOptions } from '../options.js'

/** In-memory LRU storage bounded by the number of keys. */
export class MemoryStorage {
  #entries

  constructor (options = {}) {
    const { maxKeys } = resolveOptions({ memory: options }).memory
    this.#entries = new LRUCache(maxKeys)
  }

  async acquire (key, createGeneration, windowSize) {
    const existing = this.#entries.get(key)
    if (existing) {
      return existing.generation
    }

    const generation = createGeneration()
    const state = {
      samples: new CircularBuffer(Array, windowSize),
      comparisons: new CircularBuffer(Array, Math.max(1, windowSize - 1)),
      redirectSuspended: false
    }
    this.#entries.set(key, { generation, state })
    return generation
  }

  async get (key) {
    const entry = this.#entries.get(key)
    if (!entry) {
      return undefined
    }

    return entry.state
  }

  /**
   * Access the current state only if its generation matches the caller's ticket.
   * The synchronous callback may read or mutate that state in place; its return value is ignored.
   * Validation and callback execution are atomic because neither yields to the event loop.
   * Returns false without invoking the callback when the entry is missing or has been replaced,
   * otherwise refreshes its LRU position and returns true. No historical states are retained.
   * Callback errors propagate; mutations already made are not rolled back.
   */
  async access (key, generation, callback) {
    const entry = this.#entries.peek(key)
    if (!entry || entry.generation !== generation) {
      return false
    }

    // There is no await between generation validation and replacement in this backend.
    callback(entry.state)
    this.#entries.set(key, entry)
    return true
  }

  async invalidate (key, generation) {
    if (generation !== undefined && this.#entries.peek(key)?.generation !== generation) {
      return false
    }

    return this.#entries.delete(key)
  }

  async invalidateMany (keys) {
    for (const key of keys) {
      this.#entries.delete(key)
    }
  }

  async invalidateAll () {
    this.#entries.clear()
  }
}
