import logUpdate from 'log-update'
import { pltGreen } from './colors.mjs'
import { sleep, randomBetween } from './utils.mjs'

export const say = async (messages) => {
  const _messages = Array.isArray(messages) ? messages : [messages]

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
