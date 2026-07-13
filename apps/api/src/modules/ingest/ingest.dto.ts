import {
  IsString,
  IsInt,
  IsOptional,
  IsISO8601,
  IsArray,
  ValidateNested,
  Min,
  Max,
  ArrayMaxSize,
  ArrayMinSize,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngestEventDto {
  @IsOptional()
  @IsString()
  eventId?: string | null;

  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  @IsString()
  @IsNotEmpty()
  method!: string;

  @IsInt()
  @Min(100)
  @Max(599)
  statusCode!: number;

  @IsInt()
  @Min(0)
  latencyMs!: number;

  @IsISO8601()
  ts!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rateLimitRemaining?: number | null;
}

export class IngestBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @Type(() => IngestEventDto)
  events!: IngestEventDto[];
}
