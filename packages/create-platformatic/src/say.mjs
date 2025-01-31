import logUpdate from 'log-update'
import { pltGreen } from './colors.mjs'
import { randomBetween, sleep } from './utils.mjs'

export async function say (messages) {
  const _messages = Array.isArray(messages) ? messages : [messages]

  if (process.env.NO_COLOR) {
    for (const message of _messages) {
      console.log(message)
    }

    logUpdate.done()
    return
  }

  for (const message of _messages) {
    const _message = Array.isArray(message) ? message : message.split(' ')
    const msg = []
    for (const word of [''].concat(_message)) {
      msg.push(word)
      logUpdate(pltGreen(msg.join(' ')))
      await sleep(randomBetween(75, 100))
      process.stdout.write('\u0007') // Do we want to enable terminal bell?
    }
    await sleep(randomBetween(75, 200))
  }
  logUpdate.done()
}
