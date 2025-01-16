import { parentPort, workerData } from 'node:worker_threads'
import { wire } from 'undici-thread-interceptor'

wire({ server: `http://127.0.0.1:${workerData.port}`, port: parentPort })
