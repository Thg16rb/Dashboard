import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AuthService } from '../application/auth.service';
import { SessionsService } from '../application/sessions.service';
import { LoginDto, Verify2faDto, RefreshDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { JwtAccessPayload } from '../domain/auth.types';

function meta(req: FastifyRequest) {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    deviceFingerprint: (req.headers['x-device-fingerprint'] as string) ?? undefined,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    return this.auth.login(dto.email, dto.password, meta(req));
  }

  @Post('2fa')
  verify2fa(@Body() dto: Verify2faDto, @Req() req: FastifyRequest) {
    return this.auth.verify2fa(dto.challengeToken, dto.code, meta(req));
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: FastifyRequest) {
    return this.auth.refresh(dto.refreshToken, meta(req));
  }

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  listSessions(@CurrentUser() user: JwtAccessPayload) {
    return this.sessions.listActive(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
  ) {
    return this.sessions.revoke(user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/revoke-others')
  revokeOthers(@CurrentUser() user: JwtAccessPayload) {
    return this.sessions.revokeOthers(user.sub);
  }
}
