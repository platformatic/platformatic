interface IRules {
  [key: string]: {
    role: string,
    type: string,
    find: boolean,
    delete: boolean,
    insert: boolean,
    save: boolean

  }
}

export type RoleMergeStrategy = 'first-match' | 'most-permissive'

export default function findRule (rules: IRules[], roles: string[], strategy?: RoleMergeStrategy): IRules | null
