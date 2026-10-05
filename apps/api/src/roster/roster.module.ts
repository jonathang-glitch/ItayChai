import { Module } from '@nestjs/common';
import { RosterController } from './roster.controller';

@Module({
  controllers: [RosterController],
})
export class RosterModule {}
