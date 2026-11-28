// Answers three requests in one event loop turn, the second with a value that can't be cloned, and reports what
// the requester got and the unhandled rejections of this thread. It runs in a worker so that the unhandled
// rejection doesn't fail the test.
import { MessageChannel, parentPort } from 'node:worker_threads'
import { ITC } from '../../lib/index.js'
import { BatchingITC } from '../helper.js'

const unhandled = []
process.on('unhandledRejection', error => {
  unhandled.push(error.name)
})

const { port1, port2 } = new MessageChannel()
const requester = new ITC({ port: port1, name: 'requester' })
const responder = new BatchingITC({ port: port2, name: 'responder' })

responder.handle('value', value => (value === 2 ? { value, map: new WeakMap() } : { value }))
requester.listen()
responder.listen()

const results = await Promise.all(
  [1, 2, 3].map(value => {
    return requester.send('value', value, { timeout: 200 }).then(
      response => response.value,
      error => error.code
    )
  })
)

parentPort.postMessage({ results, unhandled, posted: responder.posted.map(message => message.type) })
requester.close()
responder.close()
