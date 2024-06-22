import { expectType } from "tsd";

import { Bus } from ".";

const bus = new Bus("from");
expectType<Bus>(bus);
expectType<void>(bus.send("to", "whatever"));
expectType<void>(bus.send("to", "whatever", {}));
expectType<void>(bus.broadcast("to", "whatever", {}));
