import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../http/parse-body';
import { getPickPage, savePicks } from './pick.service';

const picksSchema = z.object({
  slotIds: z.array(z.string().min(1).max(40)).max(21),
});

@Controller('api/v1/pick')
export class PickController {
  @Get(':token')
  page(@Param('token') token: string) {
    return getPickPage(token);
  }

  @Put(':token')
  save(@Param('token') token: string, @Body() body: unknown) {
    return savePicks(token, parseBody(picksSchema, body).slotIds);
  }
}
