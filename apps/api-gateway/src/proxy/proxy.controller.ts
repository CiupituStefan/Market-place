import { setHttpRoute } from '@market/telemetry';
import { DomainError, ErrorCode } from '@market/types';
import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { resolveRoute } from '../routing/routes.js';
import { EdgeAuthGuard } from '../security/edge-auth.guard.js';
import { OriginGuard } from '../security/origin.guard.js';
import { ProxyService } from './proxy.service.js';

@ApiExcludeController()
@Controller()
@UseGuards(RateLimitGuard, OriginGuard, EdgeAuthGuard)
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('api/v1/*path')
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const route = resolveRoute(req.path);
    if (!route) throw new DomainError(ErrorCode.NOT_FOUND, 'Route not found');
    // Spans and request metrics per upstream route, not one catch-all "/api/v1/*path".
    setHttpRoute(route.prefix);
    await this.proxy.forward(req, res, route);
  }
}
