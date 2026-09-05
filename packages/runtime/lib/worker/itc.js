import { ensureLoggableError, executeInParallel, executeWithTimeout, kTimeout } from '@platformatic/foundation'
import { getEvents, getLogger, getMessaging, updateGlobals } from '@platformatic/globals'
import { ITC, initializeITCTelemetry } from '@platformatic/itc'
import { Unpromise } from '@watchable/unpromise'
import { createServer } from 'undici-thread-interceptor'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { Duplex } from 'node:stream'
import { parentPort, workerData } from 'node:worker_threads'
import {
  ApplicationExitedError,
  FailedToPerformCustomHealthCheckError,
  FailedToPerformCustomReadinessCheckError,
  FailedToRetrieveGraphQLSchemaError,
  FailedToRetrieveHealthError,
  FailedToRetrieveMetaError,
  FailedToRetrieveMetricsError,
  FailedToRetrieveOpenAPISchemaError,
  WorkerExitedError,
  exitCodes
} from '../errors.js'
import { updateUndiciInterceptors } from './interceptors.js'
import { MessagingITC } from './messaging.js'
import { kApplicationId, kITC, kId, kWorkerId } from './symbols.js'

function startSubprocessRepl (port, childManager, clientWs, controller) {
  // Start the REPL in the child process
  childManager.send(clientWs, 'startRepl').catch(err => {
    port.postMessage({ type: 'output', data: `Error starting REPL: ${err.message}\n` })
    port.postMessage({ type: 'exit' })
    port.close()
  })

  // Listen for repl:output notifications from the child process
  function handleReplOutput ({ data }) {
    port.postMessage({ type: 'output', data })
  }

  // Listen for repl:exit notifications from the child process
  function handleReplExit () {
    cleanup()
    port.postMessage({ type: 'exit' })
    port.close()
  }

  function cleanup () {
    childManager.removeListener('repl:output', handleReplOutput)
    childManager.removeListener('repl:exit', handleReplExit)
  }

  childManager.on('repl:output', handleReplOutput)
  childManager.on('repl:exit', handleReplExit)

  // Forward input from MessagePort to child process
  port.on('message', message => {
    if (message.type === 'input') {
      childManager.send(clientWs, 'replInput', { data: message.data }).catch(() => {
        // Ignore errors if the child process has exited
      })
    } else if (message.type === 'close') {
      childManager.send(clientWs, 'replClose').catch(() => {
        // Ignore errors if the child process has exited
      })
      cleanup()
    }
  })

  port.on('close', () => {
    childManager.send(clientWs, 'replClose').catch(() => {
      // Ignore errors if the child process has exited
    })
    cleanup()
  })

  return { started: true }
}

async function safeHandleInITC (worker, fn) {
  try {
    // Make sure to catch when the worker exits, otherwise we're stuck forever
    const ac = new AbortController()
    let exitCode

    const response = await Unpromise.race([
      fn(),
      once(worker, 'exit', { signal: ac.signal }).then(([code]) => {
        exitCode = code
      })
    ])

    if (typeof exitCode === 'number') {
      if (typeof worker[kWorkerId] !== 'undefined' && exitCode !== exitCodes.PROCESS_UNHANDLED_ERROR) {
        throw new WorkerExitedError(worker[kWorkerId], worker[kApplicationId], exitCode)
      } else {
        throw new ApplicationExitedError(worker[kId], exitCode)
      }
    } else {
      ac.abort()
    }

    return response
  } catch (error) {
    if (!error.handlerError) {
      throw error
    }

    if (error.handlerErrorCode && !error.handlerError.code) {
      error.handlerError.code = error.handlerErrorCode
    }

    throw error.handlerError
  }
}

async function closeITC (dispatcher, itc, messaging) {
  try {
    await dispatcher.interceptor.close()
    await dispatcher.server?.close()
    itc.close()
    messaging.close()
  } finally {
    const events = getEvents()
    events.emit('exit')
  }
}

export async function sendViaITC (worker, name, message, transferList) {
  return safeHandleInITC(worker, () => worker[kITC].send(name, message, { transferList }))
}

export async function sendMultipleViaITC (
  idsAndWorkerPairs,
  name,
  message,
  transferList,
  concurrency,
  timeout = 5000,
  timeoutFallbackValue = kTimeout
) {
  const results = await executeInParallel(
    async (id, worker) => {
      return [
        id,
        await executeWithTimeout(sendViaITC(worker, name, message, transferList), timeout, timeoutFallbackValue)
      ]
    },
    idsAndWorkerPairs,
    concurrency
  )

  return Object.fromEntries(results)
}

export async function waitEventFromITC (worker, event) {
  return safeHandleInITC(worker, () => once(worker[kITC], event))
}

export async function setupITC (controller, application, dispatcher, sharedContext) {
  await initializeITCTelemetry()

  const logger = getLogger()
  const messaging = new MessagingITC(controller.applicationConfig.id, workerData.config, logger)

  updateGlobals({
    messaging: {
      handle: messaging.handle.bind(messaging),
      send: messaging.send.bind(messaging),
      notify: messaging.notify.bind(messaging)
    }
  })

  // ITC handlers run concurrently, so later start/stop requests must wait for
  // the actual in-flight start operation rather than a controller event.
  let controllerStartPromise

  const itc = new ITC({
    name: controller.applicationConfig.id + '-worker',
    port: parentPort,
    handlers: {
      async start () {
        const status = controller.getStatus()

        if (status === 'starting') {
          await controllerStartPromise
        } else {
          // This gives a chance to a capability to perform custom logic
          const events = getEvents()
          events.emit('start')

          try {
            controllerStartPromise = controller.start()
            await controllerStartPromise
          } catch (e) {
            await controller.stop(true)

            // Reply to the runtime that the start failed, so it can cleanup
            once(itc, 'application:worker:start:processed').then(() => {
              closeITC(dispatcher, itc, messaging).catch(err => {
                logger.error(
                  { err: ensureLoggableError(err) },
                  'Failed to close the worker ITC after a failed start.'
                )
              })
            })

            // Errors are structured cloned when sent to the runtime, which drops all their custom properties (like the
            // port and the address of listen errors): send a plain object instead so that the runtime can inspect them.
            // eslint-disable-next-line no-throw-literal
            throw { name: e.name, ...ensureLoggableError(e) }
          }
        }

        const dispatchTarget = await controller.capability.getDispatchTarget()
        if (dispatchTarget == null) {
          await new Promise(() => {})
        }

        const serverTarget = dispatcher.serverHooks?.run
          ? wrapDispatchTarget(dispatchTarget, dispatcher.serverHooks.run)
          : dispatchTarget

        dispatcher.server = createServer({
          meshId: workerData.meshId,
          serverId: workerData.worker.id,
          domain: `${application.id}.plt.local`,
          server: serverTarget,
          bootstrapTimeout: workerData.config.applicationTimeout,
          metadata: {
            applicationId: application.id,
            workerId: workerData.worker.id
          },
          ...dispatcher.serverHooks
        })
        await dispatcher.server.ready

        const scheduledTasks =
          typeof controller.capability.getScheduledTasks === 'function'
            ? await controller.capability.getScheduledTasks()
            : []

        return {
          url: controller.getUrl(),
          scheduledTasks
        }
      },

      async stop ({ force, dependents }) {
        try {
          const status = controller.getStatus()

          if (!force && status === 'starting') {
            await controllerStartPromise
          }

          if (force || status.startsWith('start')) {
            // This gives a chance to a capability to perform custom logic
            const events = getEvents()
            events.emit('stop')

            await controller.stop(force, dependents)
          }
        } finally {
          // Always schedule cleanup, even when stop throws. Otherwise the worker
          // keeps open handles and runtime shutdown hangs until the grace timeout.
          once(itc, 'application:worker:stop:processed').then(() => {
            closeITC(dispatcher, itc, messaging).catch(err => {
              logger.error(
                { err: ensureLoggableError(err) },
                'Failed to close the worker ITC after stop.'
              )
            })
          })
        }
      },

      async getDependencies () {
        return controller.capability.getDependencies?.() ?? []
      },

      async build () {
        return controller.capability.build()
      },

      async removeFromMesh () {
        await dispatcher.server?.close()
        dispatcher.server = null
      },

      inject (injectParams) {
        return controller.capability.inject(injectParams)
      },

      async updateUndiciInterceptors (undiciConfig) {
        await updateUndiciInterceptors(undiciConfig)
      },

      async updateMetricsConfig (metricsConfig) {
        if (controller && typeof controller.updateMetricsConfig === 'function') {
          await controller.updateMetricsConfig(metricsConfig)
        }
        return { success: true }
      },

      async updateWorkersCount (data) {
        const { workers } = data
        workerData.applicationConfig.workers = workers
        workerData.worker.count = workers
      },

      getStatus () {
        return controller.getStatus()
      },

      getApplicationInfo () {
        return controller.capability.getInfo()
      },

      // How this worker serves, which only the worker can answer: for a worker-classified
      // capability it depends on what the application's factory returned in this worker.
      getServingState () {
        return controller.capability?.getServingState?.() ?? 'inactive'
      },

      async getApplicationConfig () {
        const current = await controller.capability.getConfig()
        // Remove all undefined keys from the config
        return JSON.parse(JSON.stringify(current))
      },

      async getApplicationEnv () {
        // Remove all undefined keys from the config
        return JSON.parse(JSON.stringify({ ...process.env, ...(await controller.capability.getEnv()) }))
      },

      async getApplicationOpenAPISchema () {
        try {
          return await controller.capability.getOpenapiSchema()
        } catch (err) {
          throw new FailedToRetrieveOpenAPISchemaError(application.id, err.message)
        }
      },

      async getApplicationGraphQLSchema () {
        try {
          return await controller.capability.getGraphqlSchema()
        } catch (err) {
          throw new FailedToRetrieveGraphQLSchemaError(application.id, err.message)
        }
      },

      async getApplicationScheduledTasks () {
        if (typeof controller.capability.getScheduledTasks !== 'function') {
          return []
        }

        return controller.capability.getScheduledTasks()
      },

      async runApplicationScheduledTasks ({ scheduleId, scheduledTime }) {
        if (typeof controller.capability.runScheduledTasks !== 'function') {
          throw new Error(`Application "${application.id}" does not support scheduled task execution`)
        }

        return controller.capability.runScheduledTasks(scheduleId, scheduledTime)
      },

      async getApplicationMeta () {
        try {
          return await controller.capability.getMeta()
        } catch (err) {
          throw new FailedToRetrieveMetaError(application.id, err.message)
        }
      },

      async getMetrics (format) {
        try {
          return await controller.getMetrics({ format })
        } catch (err) {
          throw new FailedToRetrieveMetricsError(application.id, err.message)
        }
      },

      async getHealth () {
        // Check if running in subprocess mode - forward through ChildManager
        const childManager = controller.capability?.getChildManager?.()
        const clientWs = controller.capability?.clientWs

        if (childManager && clientWs) {
          try {
            return await childManager.send(clientWs, 'getHealth')
          } catch (err) {
            throw new FailedToRetrieveHealthError(application.id, err.message)
          }
        }

        // Existing thread implementation
        try {
          return await controller.getHealth()
        } catch (err) {
          throw new FailedToRetrieveHealthError(application.id, err.message)
        }
      },

      async getCustomHealthCheck () {
        try {
          return await controller.capability.getCustomHealthCheck()
        } catch (err) {
          throw new FailedToPerformCustomHealthCheckError(application.id, err.message)
        }
      },

      async getCustomReadinessCheck () {
        try {
          return await controller.capability.getCustomReadinessCheck()
        } catch (err) {
          throw new FailedToPerformCustomReadinessCheckError(application.id, err.message)
        }
      },

      setSharedContext (context) {
        sharedContext._set(context)
      },

      saveMessagingChannel (channel) {
        messaging.addSource(channel)
      },

      takeHeapSnapshot (port) {
        const { Session } = createRequire(import.meta.url)('node:inspector')
        const session = new Session()
        session.connect()

        session.on('HeapProfiler.addHeapSnapshotChunk', (m) => {
          port.postMessage({ type: 'chunk', chunk: m.params.chunk })
        })

        session.post('HeapProfiler.takeHeapSnapshot', null, (err) => {
          session.disconnect()
          if (err) {
            port.postMessage({ type: 'error', message: err.message })
          } else {
            port.postMessage({ type: 'end' })
          }
          port.close()
        })

        return { started: true }
      },

      startRepl (port) {
        // Check if running in subprocess mode - forward through ChildManager
        const childManager = controller.capability?.getChildManager?.()
        const clientWs = controller.capability?.clientWs

        if (childManager && clientWs) {
          return startSubprocessRepl(port, childManager, clientWs, controller)
        }

        // We are loading the repl module dynamically here to avoid loading it
        // when not needed (since it pulls in domain, which is quite expensive
        // as it monkey patches EventEmitter).
        // We must use local require() instead of import
        // because dynamic import() is async and the
        // startRepl handler is sync.
        const repl = createRequire(import.meta.url)('node:repl')

        // Create a duplex stream that wraps the MessagePort
        const replStream = new Duplex({
          read () {},
          write (chunk, _, callback) {
            port.postMessage({ type: 'output', data: chunk.toString() })
            callback()
          }
        })

        port.on('message', message => {
          if (message.type === 'input') {
            replStream.push(message.data)
          } else if (message.type === 'close') {
            replStream.push(null)
          }
        })

        port.on('close', () => {
          replStream.push(null)
        })

        // Start the REPL with the stream
        const replServer = repl.start({
          prompt: `${controller.applicationConfig.id}> `,
          input: replStream,
          output: replStream,
          terminal: false,
          useColors: true,
          ignoreUndefined: true,
          preview: false
        })

        // Expose useful context
        // For service-based capabilities, expose the Fastify app
        replServer.context.app = controller.capability?.getApplication?.()
        replServer.context.capability = controller.capability
        replServer.context.platformatic = {
          capability: controller.capability,
          config: controller.config,
          events: getEvents(),
          itc,
          logger: getLogger(),
          messaging: getMessaging()
        }
        replServer.context.config = controller.applicationConfig
        replServer.context.logger = getLogger()

        replServer.on('exit', () => {
          port.postMessage({ type: 'exit' })
          port.close()
        })

        return { started: true }
      }
    }
  })

  controller.on('changed', () => {
    itc.notify('changed')
  })

  itc.listen()
  return itc
}

function wrapDispatchTarget (target, run) {
  if (typeof target.inject === 'function') {
    return {
      inject: (req, callback) => run(req, () => target.inject(req, callback)),
      server: target.server,
      emit: target.emit?.bind(target),
      listenerCount: target.listenerCount?.bind(target)
    }
  }

  if (typeof target.emit === 'function') {
    return target
  }

  return target
}
