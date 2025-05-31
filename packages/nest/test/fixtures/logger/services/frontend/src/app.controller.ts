import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  root(): object {
    globalThis.platformatic.logger?.info('Log from Nest App page')
    return this.appService.root()
  }
}
