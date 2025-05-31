import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  root(): object {
    return { production: process.env.NODE_ENV === 'production' }
  }

  direct(): object {
    return { ok: true }
  }

  async time(): Promise<object> {
    const response = await fetch('http://backend.plt.local/time')
    return response.json()
  }
}
