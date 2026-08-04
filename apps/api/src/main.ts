import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    // Desliga o parser de body do Nest; registramos o nosso (com rawBody) abaixo.
    { bodyParser: false },
  );

  await app.register(helmet);
  app.enableCors({ origin: true, credentials: true });

  // Único parser JSON: captura a string exata (rawBody) antes do JSON.parse,
  // para validar a assinatura HMAC dos webhooks sobre o corpo original.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fastify = app.getHttpAdapter().getInstance() as any;
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req: any, body: string, done: (err: Error | null, parsed?: unknown) => void) => {
      req.rawBody = body;
      try {
        done(null, body ? JSON.parse(body) : {});
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Documentação OpenAPI/Swagger interativa em /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TrafficIntel API')
    .setDescription(
      'API da plataforma de inteligência de tráfego pago e vendas. ' +
        'Autentique-se em POST /auth/login e use o accessToken como Bearer token. ' +
        'Webhooks de gateway são públicos e validados por HMAC.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Cadastro, login, 2FA e sessões')
    .addTag('webhooks', 'Recebimento de vendas dos gateways')
    .addTag('dashboard', 'KPIs e desempenho por campanha')
    .addTag('integrations', 'Conexão de contas de anúncio e gateways')
    .addTag('finance', 'Regras de imposto, taxa e custo')
    .addTag('master', 'Painel do Administrador Geral')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.API_PORT ?? 3333);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`API pronta em http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('FALHA NO BOOT DA API:', err);
  process.exit(1);
});
