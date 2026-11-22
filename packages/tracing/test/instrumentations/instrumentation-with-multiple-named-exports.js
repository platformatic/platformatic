import { InstrumentationBase } from '@opentelemetry/instrumentation'

export class Test2Instrumentation extends InstrumentationBase {
  constructor (_config) {
    super('test2-instrumenter', _config)
    this.config = _config
  }

  init () {}
}

export class TestInstrumentation extends InstrumentationBase {
  constructor (_config) {
    super('test-instrumenter', _config)
    this.config = _config
  }

  init () {}
}
