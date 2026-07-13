import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { minuteAggregates } from '@rate-snoop/db';
import { and, eq, gte, lte, desc, sql } from 'drizzle-orm';
import { MetricsQueryDto } from './metrics.dto';

@Injectable()
export class MetricsService {
  constructor(private readonly dbService: DatabaseService) {}

  private buildBaseConditions(query: MetricsQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (from > to) {
      throw new BadRequestException('from must be earlier than or equal to to');
    }

    const conditions = [
      eq(minuteAggregates.projectId, query.projectId),
      gte(minuteAggregates.bucketStart, from),
      lte(minuteAggregates.bucketStart, to),
    ];

    if (query.provider) {
      conditions.push(eq(minuteAggregates.provider, query.provider));
    }

    return conditions;
  }

  async getVolume(query: MetricsQueryDto) {
    const conditions = this.buildBaseConditions(query);

    const rows = await this.dbService.db
      .select({
        bucketStart: minuteAggregates.bucketStart,
        provider: minuteAggregates.provider,
        endpointGroup: minuteAggregates.endpointGroup,
        requestCount: minuteAggregates.requestCount,
      })
      .from(minuteAggregates)
      .where(and(...conditions))
      .orderBy(minuteAggregates.bucketStart);

    return rows.map((r) => ({
      ...r,
      bucketStart: r.bucketStart.toISOString(),
    }));
  }

  async getErrors(query: MetricsQueryDto) {
    const conditions = this.buildBaseConditions(query);

    const rows = await this.dbService.db
      .select({
        bucketStart: minuteAggregates.bucketStart,
        provider: minuteAggregates.provider,
        endpointGroup: minuteAggregates.endpointGroup,
        errorCount: minuteAggregates.errorCount,
        count429: minuteAggregates.count429,
        requestCount: minuteAggregates.requestCount,
      })
      .from(minuteAggregates)
      .where(and(...conditions))
      .orderBy(minuteAggregates.bucketStart);

    return rows.map((r) => ({
      bucketStart: r.bucketStart.toISOString(),
      provider: r.provider,
      endpointGroup: r.endpointGroup,
      errorCount: r.errorCount,
      count429: r.count429,
      requestCount: r.requestCount,
      errorRate: r.requestCount > 0 ? (r.errorCount / r.requestCount) * 100 : 0,
    }));
  }

  async getLatency(query: MetricsQueryDto) {
    const conditions = this.buildBaseConditions(query);

    const rows = await this.dbService.db
      .select({
        bucketStart: minuteAggregates.bucketStart,
        provider: minuteAggregates.provider,
        endpointGroup: minuteAggregates.endpointGroup,
        avgLatencyMs: minuteAggregates.avgLatencyMs,
        requestCount: minuteAggregates.requestCount,
      })
      .from(minuteAggregates)
      .where(and(...conditions))
      .orderBy(minuteAggregates.bucketStart);

    return rows.map((r) => ({
      ...r,
      bucketStart: r.bucketStart.toISOString(),
    }));
  }

  async getTopEndpoints(query: MetricsQueryDto) {
    const conditions = this.buildBaseConditions(query);

    const rows = await this.dbService.db
      .select({
        provider: minuteAggregates.provider,
        endpointGroup: minuteAggregates.endpointGroup,
        requestCount: sql<number>`SUM(${minuteAggregates.requestCount})::int`,
        errorCount: sql<number>`SUM(${minuteAggregates.errorCount})::int`,
        count429: sql<number>`SUM(${minuteAggregates.count429})::int`,
        avgLatencyMs: sql<number>`
          CASE
            WHEN SUM(${minuteAggregates.requestCount}) > 0
            THEN SUM(${minuteAggregates.avgLatencyMs} * ${minuteAggregates.requestCount}) / SUM(${minuteAggregates.requestCount})
            ELSE 0
          END
        `,
      })
      .from(minuteAggregates)
      .where(and(...conditions))
      .groupBy(minuteAggregates.provider, minuteAggregates.endpointGroup)
      .orderBy(desc(sql`SUM(${minuteAggregates.requestCount})`))
      .limit(20);

    return rows;
  }
}
