import { z } from 'zod';
import { publicProcedure, router } from '../../trpc';
import { prisma } from '../../db';
import { Resend } from 'resend';
import { randomBytes, createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config';

const resend = new Resend(process.env.RESEND_API_KEY);

const emailTemplatePath = path.join(__dirname, '../templates/magic-link-email.html');
const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf-8');

function buildMagicLink(token: string): string {
	const frontendUrl = config.getFrontendUrl();
	if (frontendUrl.includes('#')) {
		const [base, hash] = frontendUrl.split('#', 2);
		const url = new URL(base);
		url.searchParams.set('token', token);
		return `${url.toString()}#${hash}`;
	}
	const url = new URL(frontendUrl);
	url.searchParams.set('token', token);
	return url.toString();
}

export const authRouter = router({
	healthCheck: publicProcedure
		.query(async () => {
			const result = {
				status: 'ok',
				timestamp: new Date().toISOString(),
				message: 'Backend is online'
			};
			return result;
		}),

	requestLoginLink: publicProcedure
		.input(z.object({ email: z.string().email() }))
		.mutation(async ({ input }: { input: { email: string } }) => {
			const { email } = input;
			const user = await prisma.user.upsert({
				where: { email },
				update: {},
				create: { email },
			});

			const rawToken = randomBytes(32).toString('hex');
			const hashedToken = createHash('sha256').update(rawToken).digest('hex');
			const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

			await prisma.authToken.create({
				data: { token: hashedToken, userId: user.id, expiresAt },
			});

			const magicLink = buildMagicLink(rawToken);

			const emailHtml = emailTemplate.replace(/\{\{magicLink\}\}/g, magicLink);
			const emailText = `请点击以下链接登录:\n${magicLink}\n\n如果按钮无法点击，请将链接复制到浏览器中打开。该链接15分钟内有效。`;

			if (!config.isProduction) {
				console.log(`✨ Magic Link for ${email}: ${magicLink}`);
			}

			try {
				await resend.emails.send({
					from: `${config.email.fromName || 'YourApp'} <${config.email.from}>`,
					to: email,
					subject: '登录到 YourApp',
					html: emailHtml,
					text: emailText,
				});
				console.log(`📧 Email sent successfully to ${email}`);
			} catch (emailError) {
				console.error(`❌ Failed to send email to ${email}:`, emailError);
			}

			return { success: true };
		}),

	verifyMagicToken: publicProcedure
		.input(z.object({ token: z.string() }))
		.query(async ({ input }: { input: { token: string } }) => {
			const hashedToken = createHash('sha256').update(input.token).digest('hex');
			const authToken = await prisma.authToken.findUnique({ where: { token: hashedToken } });
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


