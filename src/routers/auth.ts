import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { prisma } from '../db';
import { Resend } from 'resend';
import { randomBytes, createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

const resend = new Resend(process.env.RESEND_API_KEY);

const emailTemplatePath = path.join(__dirname, '../templates/magic-link-email.html');
const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf-8');

export const authRouter = router({
  healthCheck: publicProcedure
    .query(async () => {
      return { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Backend is online'
      };
    }),

  requestLoginLink: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input: { email } }) => {
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email },
      });

      const rawToken = randomBytes(32).toString('hex');
      const hashedToken = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15分钟有效期

      await prisma.authToken.create({
        data: { token: hashedToken, userId: user.id, expiresAt },
      });

      const inputForLink = { token: rawToken };
      const magicLink = `${config.getBackendUrl()}/test.html?token=${rawToken}`;

      const emailHtml = emailTemplate.replace('{{magicLink}}', magicLink);

      // 在开发环境下，为了方便调试，同时在控制台打印出魔法链接
      if (!config.isProduction) {
        console.log(`✨ Magic Link for ${email}: ${magicLink}`);
      }

      // 真正发送邮件
      try {
        await resend.emails.send({
          from: config.email.from,
          to: email,
          subject: '登录到 YourApp',
          html: emailHtml,
        });
        console.log(`📧 Email sent successfully to ${email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${email}:`, emailError);
        // 即使邮件发送失败，我们仍然返回成功，因为链接已经在控制台打印了
        // 在生产环境中，你可能想要抛出错误
      }

      return { success: true };
    }),

  verifyMagicToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input, ctx }) => {
      const hashedToken = createHash('sha256').update(input.token).digest('hex');
      
      const authToken = await prisma.authToken.findUnique({
        where: { token: hashedToken },
      });

      if (!authToken || new Date() > authToken.expiresAt) {
        throw new Error('链接无效或已过期。');
      }
      
      const sessionToken = jwt.sign(
        { userId: authToken.userId },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      await prisma.authToken.delete({ where: { id: authToken.id } });

      return { sessionToken };
    }),
}); 