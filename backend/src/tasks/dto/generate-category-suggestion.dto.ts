import { IsEnum, IsOptional } from 'class-validator';

export class GenerateCategorySuggestionDto {
  @IsOptional()
  @IsEnum(['category_or_tag'])
  mode?: 'category_or_tag';

  @IsOptional()
  @IsEnum(['ru'])
  language?: 'ru';
}
