import { Module } from '@nestjs/common';
import { DemoTablesController } from './demo-tables.controller';

@Module({
  controllers: [DemoTablesController],
})
export class DemoModule {}
