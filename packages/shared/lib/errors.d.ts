import { FastifyError } from "@fastify/error";

interface IErrors {
  [key: String]: FastifyError
}

export const errors: IErrors