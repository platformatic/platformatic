import { FastifyInstance } from 'fastify'
import { AcmeBase } from './config'
export { PlatformaticApp } from '../../'

export type AcmeBaseConfig = AcmeBase

export default function acmeBase (app: FastifyInstance, opts: object) : Promise<void>

export function buildServer (opts: AcmeBase | string): Promise<FastifyInstance>
