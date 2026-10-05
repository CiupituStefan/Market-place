import {
  Authenticated,
  CurrentUser,
  openApiSchema,
  readCookie,
  ZodValidationPipe,
} from '@market/nest-common';
import { REFRESH_TOKEN_COOKIE, type AuthUser } from '@market/types';
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { toUserResponse } from '../users/user-response.js';
import { AccountRecoveryService } from './account-recovery.service.js';
import { AuthService } from './auth.service.js';
import { clearSessionCookies, setSessionCookies } from './cookies.js';
import {
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
  UserResponseSchema,
  VerifyEmailSchema,
  type LoginInput,
  type RegisterInput,
  type UserResponse,
} from './dto.js';
import { SessionService } from './session.service.js';

const userResponse = { schema: openApiSchema(z.object({ user: UserResponseSchema })) };

function clientInfo(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly recovery: AccountRecoveryService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Create an account and send a verification email' })
  @ApiBody({ schema: openApiSchema(RegisterSchema) })
  @ApiOkResponse(userResponse)
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) body: RegisterInput,
  ): Promise<{ user: UserResponse }> {
    return { user: toUserResponse(await this.auth.register(body)) };
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in; sets httpOnly session cookies' })
  @ApiBody({ schema: openApiSchema(LoginSchema) })
  @ApiOkResponse(userResponse)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: UserResponse }> {
    const { user, tokens } = await this.auth.login(body, clientInfo(req));
    setSessionCookies(res, tokens, this.config);
    return { user: toUserResponse(user) };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  @ApiOkResponse(userResponse)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: UserResponse }> {
    try {
      const { user, tokens } = await this.sessions.rotate(
        readCookie(req.headers.cookie, REFRESH_TOKEN_COOKIE),
      );
      setSessionCookies(res, tokens, this.config);
      return { user: toUserResponse(user) };
    } catch (error) {
      // Dead sessions should not leave stale cookies behind (except during a benign race).
      if (!(error instanceof Error && 'code' in error && error.code === 'TOKEN_EXPIRED')) {
        clearSessionCookies(res, this.config);
      }
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the current session and clear cookies' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken = readCookie(req.headers.cookie, REFRESH_TOKEN_COOKIE);
    if (refreshToken) await this.sessions.revokeByRefreshToken(refreshToken);
    clearSessionCookies(res, this.config);
  }

  @Get('me')
  @Authenticated()
  @ApiOperation({ summary: 'Current user' })
  @ApiOkResponse({ schema: openApiSchema(UserResponseSchema) })
  async me(@CurrentUser() principal: AuthUser): Promise<UserResponse> {
    return toUserResponse(await this.auth.findActiveUser(principal.id, principal.sessionId));
  }

  @Post('forgot-password')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Email a password reset link (same response whether or not the account exists)',
  })
  @ApiBody({ schema: openApiSchema(ForgotPasswordSchema) })
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema)) body: { email: string },
  ): Promise<void> {
    await this.recovery.requestPasswordReset(body.email);
  }

  @Post('reset-password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Set a new password with a reset token; signs out all devices' })
  @ApiBody({ schema: openApiSchema(ResetPasswordSchema) })
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) body: { token: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.recovery.resetPassword(body.token, body.password);
    clearSessionCookies(res, this.config);
  }

  @Post('verify-email')
  @HttpCode(204)
  @ApiOperation({ summary: 'Confirm an email address' })
  @ApiBody({ schema: openApiSchema(VerifyEmailSchema) })
  async verifyEmail(
    @Body(new ZodValidationPipe(VerifyEmailSchema)) body: { token: string },
  ): Promise<void> {
    await this.recovery.verifyEmail(body.token);
  }

  @Post('verify-email/resend')
  @HttpCode(202)
  @Authenticated()
  @ApiOperation({ summary: 'Send a new verification email' })
  async resendVerification(@CurrentUser() principal: AuthUser): Promise<void> {
    await this.recovery.resendVerification(principal.id);
  }
}
