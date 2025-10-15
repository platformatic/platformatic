export class RoundRobinMap extends Map {
  #instances

  constructor () {
    super()
    this.#instances = {}
  }

  set (key, worker) {
    const hasKey = super.has(key)
    if (!hasKey) {
      const application = key.split(':')[0]

      if (!this.#instances[application]) {
        this.#instances[application] = { keys: [] }
      }
      this.#instances[application].next = null
      this.#instances[application].keys.push(key)
    }

    return super.set(key, worker)
  }

  delete (key) {
    const removed = super.delete(key)

    if (removed) {
      const application = key.split(':')[0]

      if (this.#instances[application]) {
        const keys = this.#instances[application].keys
        if (keys.length <= 1) {
          delete this.#instances[application]
        } else {
          const keys = this.#instances[application].keys
          keys.splice(keys.indexOf(key), 1)
          this.#instances[application].next = null
        }
      }
    }

    return removed
  }

  getKeys (application) {
    return this.#instances[application]?.keys ?? []
  }

  next (application) {
    if (!this.#instances[application]) return

    let { next, keys } = this.#instances[application]
    if (next === null) {
      next = Math.floor(Math.random() * keys.length)
    }
    this.#instances[application].next = (next + 1) % keys.length

    return this.get(keys[next])
  }
}
