import { Module } from '@nestjs/common';
import { BreakGlassController } from './break-glass.controller';
import { DlqController } from './dlq.controller';

@Module({
  controllers: [BreakGlassController, DlqController],
})
export class OpsModule {}
