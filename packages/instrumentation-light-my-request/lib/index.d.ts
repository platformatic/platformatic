import { InstrumentationBase, type InstrumentationConfig } from '@opentelemetry/instrumentation'

export declare class LightMyRequestInstrumentation extends InstrumentationBase {
  constructor (config?: InstrumentationConfig)
  protected init (): ReturnType<InstrumentationBase['init']>
}

export default LightMyRequestInstrumentation
