import { getLogger } from '@platformatic/globals'
import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor (private readonly appService: AppService) {}

  @Get()
  root (): object {
    const logger = getLogger()
    logger.info('Log from Nest App page')
    return this.appService.root()
  }
}
