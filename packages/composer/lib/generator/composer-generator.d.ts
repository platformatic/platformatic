import { BaseGenerator } from "@platformatic/generators";

export namespace ComposerGenerator {
  export class ComposerGenerator extends BaseGenerator {
    runtimeServices: string[]
    addRuntimeService(service: string): void
  }
  
}