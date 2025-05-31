import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  root(): object {
    return { production: process.env.NODE_ENV === 'production' }
  }
}
