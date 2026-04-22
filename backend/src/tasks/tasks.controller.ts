import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BulkCreateSubtasksDto } from './dto/bulk-create-subtasks.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { GenerateCategorySuggestionDto } from './dto/generate-category-suggestion.dto';
import { GenerateDecompositionDto } from './dto/generate-decomposition.dto';
import { GeneratePrioritySuggestionDto } from './dto/generate-priority-suggestion.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksAiService } from './tasks-ai.service';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly tasksAiService: TasksAiService,
  ) {}

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListTasksQueryDto) {
    return this.tasksService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (this.isAiApplyPatch(dto)) {
      this.assertIdempotencyKey(idempotencyKey);
      return this.tasksService.updateWithIdempotency(id, dto, idempotencyKey);
    }

    return this.tasksService.update(id, dto);
  }

  @Post(':id/ai/category-suggestion')
  @HttpCode(HttpStatus.OK)
  generateCategorySuggestion(
    @Param('id') id: string,
    @Body() dto: GenerateCategorySuggestionDto,
  ) {
    void dto;
    return this.tasksAiService.generateCategorySuggestion(id);
  }

  @Post(':id/ai/priority-suggestion')
  @HttpCode(HttpStatus.OK)
  generatePrioritySuggestion(
    @Param('id') id: string,
    @Body() dto: GeneratePrioritySuggestionDto,
  ) {
    void dto;
    return this.tasksAiService.generatePrioritySuggestion(id);
  }

  @Post(':id/ai/decompose')
  @HttpCode(HttpStatus.OK)
  generateDecomposition(
    @Param('id') id: string,
    @Body() dto: GenerateDecompositionDto,
  ) {
    return this.tasksAiService.generateDecomposition(id, dto.maxSubtasks);
  }

  @Post(':id/subtasks/bulk')
  createSubtasksBulk(
    @Param('id') id: string,
    @Body() dto: BulkCreateSubtasksDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return this.tasksService.createSubtasksBulkWithIdempotency(
      id,
      dto.subtasks,
      idempotencyKey,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.tasksService.remove(id);
  }

  private isAiApplyPatch(dto: UpdateTaskDto): boolean {
    return (
      dto.classificationKind !== undefined ||
      dto.classificationValue !== undefined ||
      dto.priority !== undefined
    );
  }

  private assertIdempotencyKey(key?: string): asserts key is string {
    if (typeof key !== 'string' || key.trim().length < 6) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Idempotency-Key header is required',
        details: { field: 'Idempotency-Key' },
      });
    }
  }
}
