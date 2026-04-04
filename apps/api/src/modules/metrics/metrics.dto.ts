import { IsUUID, IsISO8601, IsOptional, IsString } from 'class-validator';

export class MetricsQueryDto {
  @IsUUID()
  projectId!: string;

  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
