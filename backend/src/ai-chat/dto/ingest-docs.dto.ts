import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DocItem {
  topic!: string;
  content!: string;
}

export class IngestDocsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocItem)
  docs!: DocItem[];
}