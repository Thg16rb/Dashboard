import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivityController } from './activity.controller';

@Module({
  imports: [AuthModule],
  controllers: [ActivityController],
})
export class ActivityModule {}
