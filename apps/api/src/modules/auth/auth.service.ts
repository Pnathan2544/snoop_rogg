import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ingestTokens } from '@rate-snoop/db';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly dbService: DatabaseService) {}

  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async validateToken(
    rawToken: string,
  ): Promise<{ projectId: string; tokenId: string } | null> {
    const hash = this.hashToken(rawToken);

    const result = await this.dbService.db
      .select({
        id: ingestTokens.id,
        projectId: ingestTokens.projectId,
      })
      .from(ingestTokens)
      .where(eq(ingestTokens.tokenHash, hash))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const token = result[0];

    // Update last_used_at asynchronously
    this.dbService.db
      .update(ingestTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(ingestTokens.id, token.id))
      .catch((err) => this.logger.error('Failed to update lastUsedAt', err));

    return { projectId: token.projectId, tokenId: token.id };
  }

  async createToken(
    projectId: string,
    name: string,
  ): Promise<{ id: string; name: string; token: string; createdAt: Date }> {
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);

    const result = await this.dbService.db
      .insert(ingestTokens)
      .values({
        projectId,
        tokenHash,
        name,
      })
      .returning({
        id: ingestTokens.id,
        name: ingestTokens.name,
        createdAt: ingestTokens.createdAt,
      });

    return {
      ...result[0],
      token: rawToken,
    };
  }

  async getTokensByProject(projectId: string) {
    return this.dbService.db
      .select({
        id: ingestTokens.id,
        name: ingestTokens.name,
        createdAt: ingestTokens.createdAt,
        lastUsedAt: ingestTokens.lastUsedAt,
      })
      .from(ingestTokens)
      .where(eq(ingestTokens.projectId, projectId));
  }
}
