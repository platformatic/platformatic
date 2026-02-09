import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import setupNestApplication from './setup'

async function bootstrap () {
  const app = await NestFactory.create(AppModule)
  await setupNestApplication(app)
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
