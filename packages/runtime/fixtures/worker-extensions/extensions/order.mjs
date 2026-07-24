import { appendFileSync } from 'node:fs'

// Records setup and close order to a file named in options, so a test can assert
// close runs in reverse. A file is used because extensions run in the worker
// thread (or child process), which does not share globals with the test.
export default function setup ({ options }) {
  const { label, orderFile } = options
  appendFileSync(orderFile, `setup:${label}\n`)

  return {
    close () {
      appendFileSync(orderFile, `close:${label}\n`)
    }
  }
}
