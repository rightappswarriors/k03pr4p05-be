import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
const prisma = new PrismaClient();
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.example.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@example.com';
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
export async function registerUser({ fullname, email, password, contactNumber }) {
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
            contactNumber,
            isVerified: false,
            verificationCode,
            role: 'OWNER',
            enabledPaymentMethod: false,
            orgId: null,
        },
    });
    // Send OTP email
    const subject = 'Verify your account';
    const text = `Please verify your account using this OTP code: ${verificationCode}`;
    const html = `<p>Welcome ${fullname},</p><p>Use the code <strong>${verificationCode}</strong> to verify your account.</p>`;
    await transporter.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject,
        text,
        html,
    });
    return user;
}
export async function verifyEmail({ email, code }) {
    const user = (await prisma.user.findUnique({ where: { email } }));
    if (!user) {
        throw new Error('User not found');
    }
    if (user.isVerified) {
        return user;
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
    return updatedUser;
}
