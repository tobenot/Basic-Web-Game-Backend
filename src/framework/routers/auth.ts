import { z } from 'zod';
import { publicProcedure, router } from '../../trpc';
import { prisma } from '../../db';
import { Resend } from 'resend';
import { randomBytes, createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config';
import { getAuthConfig } from '../../config/auth';

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

			// Dual challenge: magic link + OTP
			const rawToken = randomBytes(32).toString('hex');
			const magicTokenHash = createHash('sha256').update(rawToken).digest('hex');

			const otpLength = config.authFlow.otpLength;
			const otpCode = generateNumericOtp(otpLength);
			const codeHash = createHash('sha256').update(otpCode).digest('hex');

			const magicTtlMs = config.authFlow.magicLinkTtlSec * 1000;
			const otpTtlMs = config.authFlow.otpTtlSec * 1000;
			const createdAt = new Date();
			const expiresAt = new Date(createdAt.getTime() + Math.max(magicTtlMs, otpTtlMs));

			const challenge = await prisma.loginChallenge.create({
				data: {
					userId: user.id,
					email,
					magicTokenHash,
					codeHash,
					expiresAt,
				},
			});

			const magicLink = buildMagicLink(rawToken);

			// Render email with both link and OTP
			let emailHtml = emailTemplate.replace(/\{\{magicLink\}\}/g, magicLink);
			emailHtml = emailHtml.replace(/\{\{magicExpiryMinutes\}\}/g, `${Math.round(config.authFlow.magicLinkTtlSec / 60)}`);
			emailHtml = emailHtml.replace(/\{\{otpCode\}\}/g, otpCode);
			emailHtml = emailHtml.replace(/\{\{otpExpiryMinutes\}\}/g, `${Math.round(config.authFlow.otpTtlSec / 60)}`);

			const emailText = [
				`请点击以下链接登录:`,
				magicLink,
				'',
				`或使用验证码登录（${Math.round(config.authFlow.otpTtlSec / 60)}分钟内有效）： ${otpCode}`,
				'',
				`如果按钮无法点击，请将链接复制到浏览器中打开。`
			].join('\n');

			if (!config.isProduction) {
				console.log(`✨ Magic Link for ${email}: ${magicLink}`);
				console.log(`🔢 OTP for ${email}: ${otpCode}`);
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

			return { success: true, challengeId: challenge.id };
		}),

	verifyMagicToken: publicProcedure
		.input(z.object({ token: z.string() }))
		.query(async ({ input }: { input: { token: string } }) => {
			const hashedToken = createHash('sha256').update(input.token).digest('hex');

			// Prefer new LoginChallenge flow
			const challenge = await prisma.loginChallenge.findFirst({
				where: { magicTokenHash: hashedToken },
			});

			const now = new Date();
			const authCfg = getAuthConfig();

			if (challenge) {
				if (challenge.consumedAt) {
					throw new Error('链接已被使用。');
				}
				// method-specific TTL check using createdAt + ttl
				const createdAt = challenge.createdAt as unknown as Date;
				const magicDeadline = new Date(createdAt.getTime() + config.authFlow.magicLinkTtlSec * 1000);
				if (now > magicDeadline) {
					throw new Error('链接无效或已过期。');
				}

				const sessionToken = jwt.sign(
					{ userId: challenge.userId, amr: ['magic_link'] },
					authCfg.jwtSecret as any,
					{ expiresIn: authCfg.tokenExpiry as any }
				);
				await prisma.loginChallenge.update({
					where: { id: challenge.id },
					data: { consumedAt: new Date(), magicTokenHash: null, codeHash: null },
				});
				return { sessionToken };
			}

			// Legacy fallback to AuthToken
			const authToken = await prisma.authToken.findUnique({ where: { token: hashedToken } });
			if (!authToken || new Date() > authToken.expiresAt) {
				throw new Error('链接无效或已过期。');
			}
			const sessionToken = jwt.sign(
				{ userId: authToken.userId, amr: ['magic_link'] },
				authCfg.jwtSecret as any,
				{ expiresIn: authCfg.tokenExpiry as any }
			);
			await prisma.authToken.delete({ where: { id: authToken.id } });
			return { sessionToken };
		}),

	verifyEmailCode: publicProcedure
		.input(z.object({ challengeId: z.string(), code: z.string().min(4).max(12) }))
		.mutation(async ({ input }: { input: { challengeId: string; code: string } }) => {
			const { challengeId, code } = input;
			const challenge = await prisma.loginChallenge.findUnique({ where: { id: challengeId } });
			if (!challenge) {
				throw new Error('验证码无效或已过期。');
			}
			if (challenge.consumedAt) {
				throw new Error('该登录请求已被使用。');
			}

			const now = new Date();
			const createdAt = challenge.createdAt as unknown as Date;
			const otpDeadline = new Date(createdAt.getTime() + config.authFlow.otpTtlSec * 1000);
			if (now > otpDeadline) {
				throw new Error('验证码已过期。');
			}

			if ((challenge.codeAttempts || 0) >= config.authFlow.otpMaxAttempts) {
				throw new Error('尝试次数过多，请重新请求验证码。');
			}

			const providedHash = createHash('sha256').update(code).digest('hex');
			if (!challenge.codeHash || providedHash !== challenge.codeHash) {
				await prisma.loginChallenge.update({
					where: { id: challenge.id },
					data: { codeAttempts: (challenge.codeAttempts || 0) + 1 },
				});
				throw new Error('验证码错误。');
			}

			const authCfg = getAuthConfig();
			const sessionToken = jwt.sign(
				{ userId: challenge.userId, amr: ['otp'] },
				authCfg.jwtSecret as any,
				{ expiresIn: authCfg.tokenExpiry as any }
			);

			await prisma.loginChallenge.update({
				where: { id: challenge.id },
				data: { consumedAt: new Date(), codeHash: null, magicTokenHash: null },
			});

			return { sessionToken };
		}),
});

function generateNumericOtp(length: number): string {
	const digits = '0123456789';
	let otp = '';
	const bytes = randomBytes(length);
	for (let i = 0; i < length; i++) {
		otp += digits[bytes[i] % 10];
	}
	return otp;
}
