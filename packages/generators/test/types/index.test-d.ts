import { expectAssignable } from 'tsd'
import { ConfigField, ConfigFieldDefinition } from '../../index.js'

expectAssignable<ConfigFieldDefinition>({
  label: 'PLT_TESTING',
  var: 'testing',
  default: 'hello world',
  type: 'string',
  configValue: 'someConfigValue'
})

expectAssignable<ConfigField>({
  var: 'testing',
  configValue: 'someConfigValue',
  value: 'asd123'
})
