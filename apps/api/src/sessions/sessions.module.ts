import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { TraceController } from './trace.controller';

@Module({
  controllers: [SessionsController, TraceController],
})
export class SessionsModule {}
