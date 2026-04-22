import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { IdempotencyService } from '../common/services/idempotency.service';
import { AiController } from './ai.controller';
import { TasksController } from './tasks.controller';
import { TasksAiService } from './tasks-ai.service';
import { TasksService } from './tasks.service';

@Module({
  imports: [AiModule],
  controllers: [TasksController, AiController],
  providers: [TasksService, TasksAiService, IdempotencyService],
})
export class TasksModule {}
