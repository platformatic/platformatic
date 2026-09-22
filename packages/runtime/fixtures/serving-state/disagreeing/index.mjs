import { getWorkerId } from '@platformatic/globals'
import { createServer } from 'node:http'

/*
  Nothing stops an application from answering differently per worker, which is exactly the hazard
  the agreement check exists for: worker 0 serves HTTP and worker 1 serves nothing.
*/
export function create () {
  if (getWorkerId() === 0) {
    return createServer((_, res) => {
      res.end('ok')
    })
  }

  return { isBackgroundApplication: true }
}
