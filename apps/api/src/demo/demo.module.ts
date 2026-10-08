import { Module } from '@nestjs/common';
import { DemoTablesController } from './demo-tables.controller';
import { YossiDeskController } from './yossi-desk.controller';

@Module({
  controllers: [DemoTablesController, YossiDeskController],
})
export class DemoModule {}
