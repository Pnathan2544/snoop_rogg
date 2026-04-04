import { Controller, Get, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsQueryDto } from './metrics.dto';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('volume')
  async getVolume(@Query() query: MetricsQueryDto) {
    return this.metricsService.getVolume(query);
  }

  @Get('errors')
  async getErrors(@Query() query: MetricsQueryDto) {
    return this.metricsService.getErrors(query);
  }

  @Get('latency')
  async getLatency(@Query() query: MetricsQueryDto) {
    return this.metricsService.getLatency(query);
  }

  @Get('top-endpoints')
  async getTopEndpoints(@Query() query: MetricsQueryDto) {
    return this.metricsService.getTopEndpoints(query);
  }
}
