import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is required');
}

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'auth@platica.app';

export class EmailService {
  static async sendMagicLink(email: string, magicLink: string) {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your Platica Login Link',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Platica!</h2>
          <p>Click the button below to sign in to your account. This link will expire in 15 minutes.</p>
          <a href="${magicLink}" 
             style="display: inline-block; background: #0070f3; color: white; 
                    padding: 12px 24px; border-radius: 5px; text-decoration: none; 
                    margin: 24px 0;">
            Sign In to Platica
          </a>
          <p style="color: #666; margin-top: 24px;">
            If you didn't request this link, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 24px 0;" />
          <p style="color: #666; font-size: 14px;">
            For security, this link will only work once and expires in 15 minutes.
            If you need a new link, you can always request one at 
            <a href="${process.env.APP_URL}" style="color: #0070f3;">Platica</a>
          </p>
        </div>
      `,
      text: `
Welcome to Platica!

Click the link below to sign in to your account. This link will expire in 15 minutes.

${magicLink}

If you didn't request this link, you can safely ignore this email.

For security, this link will only work once and expires in 15 minutes.
If you need a new link, you can always request one at ${process.env.APP_URL}
      `.trim(),
    });

    if (error) {
      console.error('Failed to send magic link email:', error);
      throw new Error('Failed to send magic link email');
    }

    return data;
  }
} 