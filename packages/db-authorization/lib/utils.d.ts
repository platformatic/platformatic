import { MercuriusContext } from "mercurius";
import { FastifyRequest } from "fastify";

export function getRequestFromContext(ctx: MercuriusContext): FastifyRequest
export function getRoles(request: FastifyRequest, roleKey: string, anonymousRole: string): string[]
