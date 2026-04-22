import { IsEnum, IsOptional } from 'class-validator';

export class GeneratePrioritySuggestionDto {
  @IsOptional()
  @IsEnum(['ru'])
  language?: 'ru';
}
