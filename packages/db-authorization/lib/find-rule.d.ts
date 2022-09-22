import { MercuriusContext } from 'mercurius'
interface IRules {
  [key: string]: {
    'role': string,
    'type': string,
    'find': boolean,
    'delete': boolean,
    'insert': boolean,
    'save': boolean

  }
}

export default function findRule(ctx: MercuriusContext, rules: IRules[], roleKey: string, anonymousRole: string)
