import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GenerateDecompositionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxSubtasks: number = 6;

  @IsOptional()
  @IsEnum(['ru'])
  language?: 'ru';
}
