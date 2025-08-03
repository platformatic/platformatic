import { expectAssignable } from 'tsd'
import { BaseGenerator } from './lib/base-generator'

expectAssignable<BaseGenerator.ConfigFieldDefinition>({
  label: 'PLT_TESTING',
  var: 'testing',
  default: 'hello world',
  type: 'string',
  configValue: 'someConfigValue'
})

expectAssignable<BaseGenerator.ConfigField>({
  var: 'testing',
  configValue: 'someConfigValue',
  value: 'asd123'
})
