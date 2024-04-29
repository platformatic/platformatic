import { expectAssignable } from 'tsd'
import { BaseGenerator } from './lib/base-generator';
import { generatePlugins, generateTests } from './index'
import { FileGenerator } from './lib/file-generator';

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

expectAssignable<FileGenerator.FileObject[]>(generatePlugins(true))

expectAssignable<FileGenerator.FileObject[]>(generateTests(true, '@platformatic/service'))
