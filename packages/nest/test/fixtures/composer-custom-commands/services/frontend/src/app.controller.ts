import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor (private readonly appService: AppService) {}

  @Get()
  root (): object {
    return this.appService.root()
  }

  @Get('/direct')
  async direct (): Promise<object> {
    return this.appService.direct()
  }

  @Get('/time')
  async time (): Promise<object> {
    return this.appService.time()
  }
}
