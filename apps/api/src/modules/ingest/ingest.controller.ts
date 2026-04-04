import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IngestService } from './ingest.service';
import { IngestBatchDto } from './ingest.dto';
import { AuthenticatedRequest } from '../auth/auth.middleware';

@Controller('ingest')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestEvents(
    @Req() req: AuthenticatedRequest,
    @Body() dto: IngestBatchDto,
  ) {
    const projectId = req.projectId!;
    return this.ingestService.enqueueBatch(projectId, dto);
  }

  @Get('queue-stats')
  async getQueueStats() {
    return this.ingestService.getQueueStats();
  }
}
