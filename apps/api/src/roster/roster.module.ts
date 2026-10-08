import { Module } from '@nestjs/common';
import { PickController } from './pick.controller';
import { RosterController } from './roster.controller';

@Module({
  controllers: [RosterController, PickController],
})
export class RosterModule {}
