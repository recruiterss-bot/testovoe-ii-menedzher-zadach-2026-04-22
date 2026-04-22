import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  SUGGESTION_KIND_VALUES,
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
} from '../domain/task.enums';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsEnum(TASK_PRIORITY_VALUES)
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsEnum(TASK_STATUS_VALUES)
  status?: 'todo' | 'in_progress' | 'done';

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date | null;

  @IsOptional()
  @IsEnum(SUGGESTION_KIND_VALUES)
  classificationKind?: 'category' | 'tag' | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  classificationValue?: string | null;
}
