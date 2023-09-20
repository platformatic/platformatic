import { expectError, expectType } from 'tsd' 
import { command } from '@platformatic/client-cli'

expectType<Promise<void>>(command(['arg1', 'arg2']))
expectType<void>(await command(['arg1', 'arg2']))

expectError(command(['string', 123]))
expectError(command('string'))

expectType<void>(await command(['arg1', 'arg2']))