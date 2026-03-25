import nodemailer from 'nodemailer';
import { marked } from 'marked';
import { app } from 'electron';

// ─────────────────────────────────────────────────────────────
// SMTP Transporter
// ─────────────────────────────────────────────────────────────

// Lazily create transporter to ensure .env is loaded (which happens in settings.ts)
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[Email] SMTP configuration is missing in .env');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

// ─────────────────────────────────────────────────────────────
// Send MOM Email
// ─────────────────────────────────────────────────────────────

export async function sendMOMEmail(content: string): Promise<boolean> {
  const recipient = process.env.MOM_RECIPIENT || 'scout.kalra@itbd.net';
  const from = process.env.SMTP_FROM || 'notifications@mspgenie.online';
  
  const transporter = getTransporter();

  try {
    console.log(`[Email] Sending Minutes of Meeting to ${recipient}...`);
    
    const htmlContent = await marked.parse(content);

    await transporter.sendMail({
      from: `"ClawWrite Assistant" <${from}>`,
      to: recipient,
      subject: `📝 Minutes of Meeting - ${new Date().toLocaleDateString()}`,
      text: content,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; line-height: 1.6; color: #1e293b; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #7c3aed; margin-top: 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">Minutes of Meeting</h2>
            <div style="color: #334155;">
              ${htmlContent}
            </div>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 32px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">Sent automatically by ClawWrite.</p>
          </div>
        </div>
      `,
    });

    console.log('[Email] MOM sent successfully.');
    return true;
  } catch (error) {
    console.error('[Email] Error sending MOM email:', error);
    return false;
  }
}
