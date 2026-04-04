import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, CreateTokenDto } from './projects.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get(':id/tokens')
  async getTokens(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.getTokens(id);
  }

  @Post(':id/tokens')
  @HttpCode(HttpStatus.CREATED)
  async createToken(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTokenDto,
  ) {
    return this.projectsService.createToken(id, dto.name);
  }
}
