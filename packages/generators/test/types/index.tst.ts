import { expect } from 'tstyche'
import { ConfigField, ConfigFieldDefinition } from '../../index.js'

expect({
  label: 'PLT_TESTING',
  var: 'testing',
  default: 'hello world',
  type: 'string' as const,
  configValue: 'someConfigValue'
}).type.toBeAssignableTo<ConfigFieldDefinition>()

expect({
  var: 'testing',
  configValue: 'someConfigValue',
  value: 'asd123'
}).type.toBeAssignableTo<ConfigField>()
