import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TASK_PRIORITY_VALUES, TASK_STATUS_VALUES } from '../domain/task.enums';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsEnum(TASK_PRIORITY_VALUES)
  priority!: 'low' | 'medium' | 'high';

  @IsEnum(TASK_STATUS_VALUES)
  status!: 'todo' | 'in_progress' | 'done';

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date | null;

  @IsOptional()
  @IsString()
  parentTaskId?: string | null;
}
