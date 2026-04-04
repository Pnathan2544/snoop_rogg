import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

export interface AuthenticatedRequest extends Request {
  projectId?: string;
  tokenId?: string;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(private readonly authService: AuthService) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);
    if (!token) {
      throw new UnauthorizedException('Empty token');
    }

    const result = await this.authService.validateToken(token);
    if (!result) {
      throw new UnauthorizedException('Invalid token');
    }

    req.projectId = result.projectId;
    req.tokenId = result.tokenId;

    next();
  }
}
