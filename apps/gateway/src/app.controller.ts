import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  home() {
    return { message: 'Welcome do gateway.p2p.works' }
  }
}
