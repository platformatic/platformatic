import { ITC } from '@platformatic/itc'
import { subscribe, unsubscribe } from 'node:diagnostics_channel'
import { once } from 'node:events'
import { workerData } from 'node:worker_threads'
import { request } from 'undici'

export const childProcessWorkerFile = new URL('./child-process.js', import.meta.url)

export class ChildManager extends ITC {
  #child
  #listener
  #injectedNodeOptions
  #originalNodeOptions

  constructor ({ loader, context }) {
    super({
      handlers: {
        log (message) {
          workerData.loggingPort.postMessage(JSON.parse(message))
        },
        fetch: request => {
          return this.#fetch(request)
        }
      }
    })

    const childHandler = ({ process: child }) => {
      unsubscribe('child_process', childHandler)

      this.#child = child
      this.#child.once('exit', () => {
        this.emit('exit')
      })

      this.listen()
    }

    subscribe('child_process', childHandler)

    this.#prepareChildEnvironment(loader, context)
  }

  inject () {
    process.env.NODE_OPTIONS = this.#injectedNodeOptions
  }

  eject () {
    process.env.NODE_OPTIONS = this.#originalNodeOptions
  }

  _setupListener (listener) {
    this.#listener = listener
    this.#child.on('message', this.#listener)
  }

  _send (request) {
    this.#child.send(request)
  }

  _createClosePromise () {
    return once(this.#child, 'exit')
  }

  _close () {
    this.#child.removeListener('message', this.#listener)
    this.#child.kill('SIGKILL')
  }

  #prepareChildEnvironment (loader, context) {
    this.#originalNodeOptions = process.env.NODE_OPTIONS

    const loaderScript = `
      import { register } from 'node:module';
      globalThis.platformatic=${JSON.stringify(context).replaceAll('"', '\\"')};    
      register('${loader}',{ data: globalThis.platformatic });
    `

    this.#injectedNodeOptions = [
      `--import="data:text/javascript,${loaderScript.replaceAll(/\n/g, '')}"`,
      `--import=${childProcessWorkerFile}`,
      process.env.NODE_OPTIONS ?? ''
    ].join(' ')
  }

  async #fetch (opts) {
    const { statusCode, headers, body } = await request(opts)

    const rawPayload = Buffer.from(await body.arrayBuffer())
    const payload = rawPayload.toString()

    return { statusCode, headers, body: payload, payload, rawPayload }
  }
}
