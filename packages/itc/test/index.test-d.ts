import { MessagePort } from 'node:worker_threads'
import { expectError, expectType } from 'tsd'
import { ITC, ITCConstructorOptions } from '../lib/index'

const mockPort = {} as MessagePort

const options: ITCConstructorOptions = { port: mockPort }
expectType<ITCConstructorOptions>(options)

const itc = new ITC({ port: mockPort })
expectType<ITC>(itc)

expectType<Promise<any>>(itc.send('testMessage', { key: 'value' }))
expectType<void>(itc.notify('testMessage', { key: 'value' }))
expectType<void>(
  itc.handle('testMessage', async data => {
    return { key: 'value' }
  })
)
expectType<void>(itc.listen())
expectType<void>(itc.close())

expectError(itc.send(123, { key: 'value' })) // send name must be a string
expectError(itc.notify(123, { key: 'value' })) // send name must be a string
expectError(
  itc.handle(123, async data => {
    return { key: 'value' }
  })
) // handle message must be a string

itc.on('unhandledError', (error: Error) => {
  expectType<Error>(error)
})
