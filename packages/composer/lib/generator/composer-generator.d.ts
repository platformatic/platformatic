import { BaseGenerator } from "@platformatic/generators";
import RuntimeGenerator from "../../../runtime/lib/generator/runtime-generator";

export namespace ComposerGenerator {
  export class ComposerGenerator extends BaseGenerator {
    runtime: RuntimeGenerator

    setRuntime(runtime: RuntimeGenerator)
  }
  
}