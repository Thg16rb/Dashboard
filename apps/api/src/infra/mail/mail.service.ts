import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Envio de e-mails transacionais via SMTP (BLUEPRINT — recuperação de senha).
 * Configuração 100% por env (SMTP_HOST/PORT/USER/PASS/FROM); nunca hardcoded.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get('SMTP_PORT', 587));
    const secure = this.config.get('SMTP_SECURE', 'false') === 'true';
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.from = this.config.get<string>('SMTP_FROM', 'TrafficIntel <no-reply@sistemautomacao.com>');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'TrafficIntel — Redefinição de senha',
        text: `Recebemos um pedido de redefinição de senha. Acesse o link abaixo (válido por 1 hora):\n\n${resetUrl}\n\nSe você não solicitou, ignore este e-mail.`,
        html: `
          <div style="font-family: monospace; background:#0b0d0c; color:#eef3e8; padding:24px;">
            <p style="letter-spacing:0.05em;">Recebemos um pedido de redefinição de senha para a sua conta <b>TrafficIntel</b>.</p>
            <p><a href="${resetUrl}" style="color:#b6ff3d;">Clique aqui para redefinir sua senha</a></p>
            <p style="font-size:12px;color:#6d766c;">Este link expira em 1 hora. Se você não solicitou, ignore este e-mail.</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail de reset para ${to}: ${(err as Error).message}`);
      throw err;
    }
  }
}
