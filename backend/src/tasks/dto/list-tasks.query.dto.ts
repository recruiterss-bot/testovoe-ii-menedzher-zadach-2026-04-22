import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TASK_PRIORITY_VALUES, TASK_STATUS_VALUES } from '../domain/task.enums';

const TASK_SORT_BY_VALUES = [
  'createdAt',
  'dueDate',
  'priority',
  'updatedAt',
] as const;
const SORT_ORDER_VALUES = ['asc', 'desc'] as const;

export type TaskSortBy = (typeof TASK_SORT_BY_VALUES)[number];
export type SortOrder = (typeof SORT_ORDER_VALUES)[number];

export class ListTasksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsEnum(TASK_SORT_BY_VALUES)
  sortBy: TaskSortBy = 'createdAt';

  @IsOptional()
  @IsEnum(SORT_ORDER_VALUES)
  sortOrder: SortOrder = 'desc';

  @IsOptional()
  @IsEnum(TASK_STATUS_VALUES)
  status?: 'todo' | 'in_progress' | 'done';

  @IsOptional()
  @IsEnum(TASK_PRIORITY_VALUES)
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDateFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDateTo?: Date;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    const normalized = String(value).toLowerCase();

    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }

    return undefined;
  })
  @IsBoolean()
  isOverdue?: boolean;
}
