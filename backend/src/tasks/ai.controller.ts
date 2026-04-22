import { Controller, Get, Query } from '@nestjs/common';
import { GetWorkloadSummaryQueryDto } from './dto/get-workload-summary.query.dto';
import { TasksAiService } from './tasks-ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly tasksAiService: TasksAiService) {}

  @Get('workload-summary')
  getWorkloadSummary(@Query() query: GetWorkloadSummaryQueryDto) {
    return this.tasksAiService.generateWorkloadSummary(query.upcomingDays);
  }
}
