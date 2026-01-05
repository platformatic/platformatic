import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  root (): object {
    return { production: globalThis.platformatic?.production ?? false }
  }
}
