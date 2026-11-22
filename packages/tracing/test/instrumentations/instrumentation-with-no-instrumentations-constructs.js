import { InstrumentationBase } from '@opentelemetry/instrumentation'

export class Test2 extends InstrumentationBase {
  constructor (_config) {
    super('test2-instrumenter', _config)
    this.config = _config
  }

  init () {}
}

export class Test extends InstrumentationBase {
  constructor (_config) {
    super('test-instrumenter', _config)
    this.config = _config
  }

  init () {}
}
