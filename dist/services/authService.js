import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
console.log('[AUTH SERVICE] Initializing - RESEND_API_KEY exists:', !!RESEND_API_KEY);
console.log('[AUTH SERVICE] RESEND_API_KEY starts with:', RESEND_API_KEY ? RESEND_API_KEY.substring(0, 7) + '...' : 'NOT SET');
console.log('[AUTH SERVICE] EMAIL_FROM:', EMAIL_FROM);
// Validate JWT secrets
if (!JWT_SECRET) {
    console.warn('[AUTH SERVICE] WARNING: JWT_SECRET is not set!');
}
if (!REFRESH_SECRET) {
    console.warn('[AUTH SERVICE] WARNING: REFRESH_SECRET is not set!');
}
if (RESEND_API_KEY && !RESEND_API_KEY.startsWith('re_')) {
    console.warn('[AUTH SERVICE] WARNING: RESEND_API_KEY does not appear to be a valid Resend API key (should start with "re_")');
}
const resend = new Resend(RESEND_API_KEY);
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
export async function registerUser({ fullname, role, email, password, contactNumber }) {
    console.log('[DEBUG] registerUser called with:', { fullname, email, contactNumber, role });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new Error('User with this email already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateOTP();
    const user = await prisma.user.create({
        data: {
            fullname,
            username: email.split('@')[0] + Date.now().toString().slice(-4),
            email,
            password: hashedPassword,
            contactNumber: contactNumber || '',
            isVerified: false,
            verificationCode,
            role: role || "OWNER",
            enabledPaymentMethod: false,
            orgId: null,
        },
    });
    console.log('Created user: ', user);
    // Send OTP email
    const subject = 'Verify your account';
    const html = `<p>Welcome ${fullname},</p><p>Use the code <strong>${verificationCode}</strong> to verify your account.</p>`;
    console.log('[DEBUG] Attempting to send OTP email to:', email);
    console.log('[DEBUG] OTP code:', verificationCode);
    console.log('[DEBUG] Email from:', EMAIL_FROM);
    console.log('[DEBUG] RESEND_API_KEY exists:', !!RESEND_API_KEY);
    console.log('[DEBUG] NODE_ENV:', process.env.NODE_ENV);
    try {
        const emailResult = await resend.emails.send({
            from: EMAIL_FROM,
            to: email,
            subject,
            html,
        });
        console.log('[DEBUG] Email send result:', JSON.stringify(emailResult, null, 2));
    }
    catch (error) {
        console.error('[DEBUG] Failed to send verification email - Error type:', typeof error);
        console.error('[DEBUG] Failed to send verification email - Error message:', error?.message || error);
        console.error('[DEBUG] Failed to send verification email - Full error:', error);
        throw new Error(`Failed to send verification email: ${error?.message || error}`);
    }
    console.log('[DEBUG] OTP email sent successfully for registration');
    return user;
}
export async function verifyEmail({ email, code, res }) {
    const user = (await prisma.user.findUnique({ where: { email } }));
    if (!user) {
        throw new Error('User not found');
    }
    if (user.isVerified) {
        // If already verified, just return tokens
        const token = jwt.sign({
            userId: user.id,
            role: user.role,
            email: user.email
        }, JWT_SECRET, { expiresIn: "1d" });
        const refresh_token = jwt.sign({
            userId: user.id,
        }, REFRESH_SECRET, { expiresIn: "24h" });
        res.cookie("jid", refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/graphql"
        });
        const { password: _, ...userWithoutPassword } = user;
        return { user: userWithoutPassword, token, refresh_token };
    }
    if (user.verificationCode !== code) {
        throw new Error('Invalid verification code');
    }
    const updatedUser = await prisma.user.update({
        where: { email },
        data: {
            isVerified: true,
            verificationCode: null,
        },
    });
    // Generate tokens for the verified user
    const token = jwt.sign({
        userId: updatedUser.id,
        role: updatedUser.role,
        email: updatedUser.email
    }, JWT_SECRET, { expiresIn: "1d" });
    const refresh_token = jwt.sign({
        userId: updatedUser.id,
    }, REFRESH_SECRET, { expiresIn: "24h" });
    res.cookie("jid", refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/graphql"
    });
    const { password: __, ...userWithoutPassword } = updatedUser;
    return { user: userWithoutPassword, token, refresh_token };
}
export async function resendOTP({ email }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new Error('User not found');
    }
    if (user.isVerified) {
        throw new Error('User is already verified');
    }
    const verificationCode = generateOTP();
    // Update user with new verification code
    await prisma.user.update({
        where: { email },
        data: {
            verificationCode,
        },
    });
    // Send OTP email
    const subject = 'Verify your account';
    const html = `<p>Your verification code is: <strong>${verificationCode}</strong></p>`;
    console.log('[DEBUG] Attempting to resend OTP email to:', email);
    console.log('[DEBUG] New OTP code:', verificationCode);
    console.log('[DEBUG] Email from:', EMAIL_FROM);
    console.log('[DEBUG] RESEND_API_KEY exists:', !!RESEND_API_KEY);
    console.log('[DEBUG] NODE_ENV:', process.env.NODE_ENV);
    try {
        const emailResult = await resend.emails.send({
            from: EMAIL_FROM,
            to: email,
            subject,
            html,
        });
        console.log('[DEBUG] Resend OTP email send result:', JSON.stringify(emailResult, null, 2));
    }
    catch (error) {
        console.error('[DEBUG] Failed to resend OTP email - Error type:', typeof error);
        console.error('[DEBUG] Failed to resend OTP email - Error message:', error?.message || error);
        console.error('[DEBUG] Failed to resend OTP email - Full error:', error);
        throw new Error(`Failed to send verification email: ${error?.message || error}`);
    }
    console.log('[DEBUG] OTP email resent successfully');
    return { message: 'OTP sent successfully' };
}
