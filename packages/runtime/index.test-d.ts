import { expectError, expectType } from 'tsd';
import { LightMyRequestResponse } from 'fastify';
import { pltRuntimeBuildServer, errors } from '.';
import { FastifyError } from '@fastify/error'

const server: pltRuntimeBuildServer = {
  address: 'localhost',
  port: 3000,
  restart: async () => { },
  stop: async () => { },
  inject: async () => ({} as LightMyRequestResponse),
};

expectType<pltRuntimeBuildServer>(server);
expectError<pltRuntimeBuildServer>({ ...server, address: 42 });
expectError<pltRuntimeBuildServer>({ ...server, port: 'WRONG' });
expectError<pltRuntimeBuildServer>({ ...server, restart: 'WRONG' });
expectError<pltRuntimeBuildServer>({ ...server, stop: 'WRONG' });
expectError<pltRuntimeBuildServer>({ ...server, inject: 'WRONG' });

// Errors
type ErrorWithNoParams = () => FastifyError
type ErrorWithOneParam = (param: string) => FastifyError
type ErrorWithOneAnyParam = (param: string) => FastifyError
type ErrorWithTwoParams = (param1: string, param2: string) => FastifyError

expectType<ErrorWithNoParams>(errors.RuntimeExitedError)
expectType<ErrorWithOneParam>(errors.UnknownRuntimeAPICommandError)
expectType<ErrorWithOneParam>(errors.ServiceNotFoundError)
expectType<ErrorWithOneParam>(errors.ServiceNotStartedError)
expectType<ErrorWithTwoParams>(errors.FailedToRetrieveOpenAPISchemaError)
expectType<ErrorWithNoParams>(errors.ApplicationAlreadyStartedError)
expectType<ErrorWithNoParams>(errors.ApplicationNotStartedError)
expectType<ErrorWithNoParams>(errors.ConfigPathMustBeStringError)
expectType<ErrorWithOneParam>(errors.NoConfigFileFoundError)
expectType<ErrorWithOneParam>(errors.InvalidEntrypointError)
expectType<ErrorWithOneParam>(errors.MissingDependencyError)
expectType<ErrorWithNoParams>(errors.InspectAndInspectBrkError)
expectType<ErrorWithNoParams>(errors.InspectorPortError)
expectType<ErrorWithNoParams>(errors.InspectorHostError)
expectType<ErrorWithOneParam>(errors.CannotMapSpecifierToAbsolutePathError)
expectType<ErrorWithNoParams>(errors.NodeInspectorFlagsNotSupportedError)

