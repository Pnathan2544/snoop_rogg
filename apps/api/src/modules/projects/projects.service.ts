import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { projects } from '@rate-snoop/db';
import { eq } from 'drizzle-orm';
import { AuthService } from '../auth/auth.service';
import { CreateProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly dbService: DatabaseService,
    private readonly authService: AuthService,
  ) {}

  async findAll() {
    return this.dbService.db
      .select()
      .from(projects)
      .orderBy(projects.createdAt);
  }

  async findOne(id: string) {
    const result = await this.dbService.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return result[0];
  }

  async create(dto: CreateProjectDto) {
    const result = await this.dbService.db
      .insert(projects)
      .values({ name: dto.name })
      .returning();

    this.logger.log(`Created project: ${result[0].id}`);
    return result[0];
  }

  async createToken(projectId: string, name: string) {
    // Verify project exists
    await this.findOne(projectId);
    return this.authService.createToken(projectId, name);
  }

  async getTokens(projectId: string) {
    // Verify project exists
    await this.findOne(projectId);
    return this.authService.getTokensByProject(projectId);
  }
}
