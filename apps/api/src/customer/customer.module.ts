import { Module } from '@nestjs/common';
import { CustomerController, CustomerOffersController } from './customer.controller';

@Module({
  controllers: [CustomerController, CustomerOffersController],
})
export class CustomerModule {}
