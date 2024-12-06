import { safeRemove } from '@platformatic/utils'
import { createReadStream, createWriteStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export default class FileCacheStore {
  #root

  constructor (opts) {
    this.#root = opts.root

    if (!this.#root) {
      throw new Error('root option is required')
    }
  }

  get (req) {
    const [valuePath, bodyPath] = this.#getPaths(req)

    if (!existsSync(valuePath) || !existsSync(bodyPath)) {
      return
    }

    const value = JSON.parse(readFileSync(valuePath, 'utf-8'))

    if (value.vary != null) {
      for (const [key, val] of Object.entries(value.vary)) {
        if (req.headers[key] !== val) {
          return
        }
      }
    }

    const body = createReadStream(bodyPath)
    return { ...value, body }
  }

  createWriteStream (req, value) {
    const [valuePath, bodyPath] = this.#getPaths(req)

    writeFileSync(valuePath, JSON.stringify(value), 'utf-8')
    return createWriteStream(bodyPath)
  }

  delete (req) {
    return Promise.all(this.#getPaths(req).map(safeRemove))
  }

  #getPaths (req) {
    const { origin, method, path } = req
    const base = Buffer.from(JSON.stringify({ method, origin, path })).toString('base64url')

    return [resolve(this.#root, `${base}-value`), resolve(this.#root, `${base}-body`)]
  }
}
