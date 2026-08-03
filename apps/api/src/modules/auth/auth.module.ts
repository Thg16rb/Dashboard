import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './infra/auth.controller';
import { AuthService } from './application/auth.service';
import { TokenService } from './application/token.service';
import { TotpService } from './application/totp.service';
import { SessionsService } from './application/sessions.service';
import { JwtStrategy } from './infra/jwt.strategy';

/**
 * AuthModule — JWT + Refresh rotativo + 2FA TOTP (BLUEPRINT seção 3.3/3.4).
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    TotpService,
    SessionsService,
    JwtStrategy,
  ],
  exports: [TokenService],
})
export class AuthModule {}
