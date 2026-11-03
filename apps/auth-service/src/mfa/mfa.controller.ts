import { Authenticated, CurrentUser, openApiSchema, ZodValidationPipe } from '@market/nest-common';
import type { AuthUser } from '@market/types';
import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { clearSessionCookies } from '../auth/cookies.js';
import { MfaDisableSchema, MfaEnableSchema, MfaSetupSchema } from '../auth/dto.js';
import { SessionService } from '../auth/session.service.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { MfaService } from './mfa.service.js';

/**
 * Two-step sign-in for the signed-in account. Turning it on or off signs every device out: the
 * next sign-in shows whether the change took (and a stolen session does not survive it).
 */
@ApiTags('auth')
@Controller('auth/mfa')
@Authenticated()
export class MfaController {
  constructor(
    private readonly mfa: MfaService,
    private readonly sessions: SessionService,
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Whether two-step sign-in is on, and recovery codes left' })
  async status(
    @CurrentUser() principal: AuthUser,
  ): Promise<{ enabled: boolean; recoveryCodesLeft: number; sessionVerified: boolean }> {
    const left = await this.mfa.recoveryCodesLeft(principal.id);
    return {
      enabled: await this.mfa.isEnabledFor(principal.id),
      recoveryCodesLeft: left,
      sessionVerified: await this.sessions.isMfaVerified(principal.sessionId),
    };
  }

  @Post('setup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start setup: a new secret and its otpauth:// URI (password required)' })
  @ApiBody({ schema: openApiSchema(MfaSetupSchema) })
  async setup(
    @CurrentUser() principal: AuthUser,
    @Body(new ZodValidationPipe(MfaSetupSchema)) body: z.infer<typeof MfaSetupSchema>,
  ): Promise<{ secret: string; otpauthUri: string }> {
    return this.mfa.startSetup(principal.id, body.password);
  }

  @Post('enable')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm with a code; returns the recovery codes once; signs out' })
  @ApiBody({ schema: openApiSchema(MfaEnableSchema) })
  async enable(
    @CurrentUser() principal: AuthUser,
    @Body(new ZodValidationPipe(MfaEnableSchema)) body: z.infer<typeof MfaEnableSchema>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ recoveryCodes: string[] }> {
    const recoveryCodes = await this.db.transaction(async (tx) => {
      const codes = await this.mfa.enable(principal.id, body.code, tx);
      await this.sessions.revokeAllForUser(principal.id, 'mfa_enabled', tx);
      return codes;
    });
    clearSessionCookies(res, this.config);
    return { recoveryCodes };
  }

  @Post('disable')
  @HttpCode(204)
  @ApiOperation({ summary: 'Turn off (password and a code required); signs out' })
  @ApiBody({ schema: openApiSchema(MfaDisableSchema) })
  async disable(
    @CurrentUser() principal: AuthUser,
    @Body(new ZodValidationPipe(MfaDisableSchema)) body: z.infer<typeof MfaDisableSchema>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.mfa.disable(principal.id, body.password, body.code, tx);
      await this.sessions.revokeAllForUser(principal.id, 'mfa_disabled', tx);
    });
    clearSessionCookies(res, this.config);
  }
}
