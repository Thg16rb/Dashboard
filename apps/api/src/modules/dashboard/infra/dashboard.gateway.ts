import { OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtAccessPayload } from '../../auth/domain/auth.types';

/**
 * Tempo real do dashboard (BLUEPRINT seções 1.2/5.3).
 * Assina os canais tenant:*:metrics no Redis e reencaminha os eventos para a
 * "room" do respectivo tenant. Autentica o socket pelo JWT no handshake.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/realtime' })
export class DashboardGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer() server!: Server;
  private sub!: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  onModuleInit(): void {
    this.sub = new Redis(this.config.get('REDIS_URL', 'redis://localhost:6379'), {
      maxRetriesPerRequest: null,
    });
    // Padrão tenant:<id>:metrics
    this.sub.psubscribe('tenant:*:metrics');
    this.sub.on('pmessage', (_pattern, channel, message) => {
      const tenantId = channel.split(':')[1];
      this.server.to(`tenant:${tenantId}`).emit('metrics', JSON.parse(message));
    });
  }

  handleConnection(client: Socket): void {
    try {
      const token =
        (client.handshake.auth?.token as string) ??
        (client.handshake.query?.token as string);
      const payload = this.jwt.verify<JwtAccessPayload>(token, {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      });
      client.join(`tenant:${payload.tenantId}`);
    } catch {
      client.disconnect();
    }
  }
}
