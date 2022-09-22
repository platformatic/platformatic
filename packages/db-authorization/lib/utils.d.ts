import { MercuriusContext } from "mercurius";
import { FastifyRequest, FastifyReply } from "fastify";

export function getRequestFromContext(ctx: MercuriusContext): FastifyReply
export function getRoles(request: FastifyRequest, roleKey: string, anonymousRole: string): string[]
