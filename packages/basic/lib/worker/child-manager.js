import { ITC } from '@platformatic/itc'
import { subscribe, unsubscribe } from 'node:diagnostics_channel'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { workerData } from 'node:worker_threads'

export const childProcessWorkerFile = fileURLToPath(new URL('./child-process.js', import.meta.url))

export class ChildManager extends ITC {
  #child
  #listener
  #injectedNodeOptions
  #originalNodeOptions

  constructor ({ loader, context }) {
    super({})

    const childHandler = ({ process: child }) => {
      unsubscribe('child_process', childHandler)

      this.#child = child
      this.#child.once('exit', () => {
        this.emit('exit')
      })

      this.listen()
    }

    subscribe('child_process', childHandler)

    this.handle('log', message => {
      workerData.loggingPort.postMessage(JSON.parse(message))
    })

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
      process.env.NODE_OPTIONS ?? '',
    ].join(' ')
  }
}
