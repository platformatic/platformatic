import { InstrumentationBase } from '@opentelemetry/instrumentation'

export default class TestInstrumentation extends InstrumentationBase {
  constructor (_config) {
    super('test-instrumenter', _config)
    this.config = _config
  }

  init () {}
}
