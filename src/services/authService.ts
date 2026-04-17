
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt'
import nodemailer from 'nodemailer'
import jwt from 'jsonwebtoken'
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@example.com'
const JWT_SECRET = process.env.JWT_SECRET
const REFRESH_SECRET = process.env.REFRESH_SECRET

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
})

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function registerUser({ fullname, role, email, password, contactNumber } : { fullname: string, role?: string, password: string, contactNumber: string, email: string}) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new Error('User with this email already exists')
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const verificationCode = generateOTP()

  const user = await prisma.user.create({
    data: {
      fullname,
      username: email.split('@')[0] + Date.now().toString().slice(-4),
      email,
      password: hashedPassword,
      contactNumber,
      isVerified: false,
      verificationCode,
      role: role ? role : "OWNER",
      enabledPaymentMethod: false,
      orgId: null,
    } as any,
  }) as any
  console.log('Created user: ', user)
  // Send OTP email
  const subject = 'Verify your account'
  const text = `Please verify your account using this OTP code: ${verificationCode}`
  const html = `<p>Welcome ${fullname},</p><p>Use the code <strong>${verificationCode}</strong> to verify your account.</p>`

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject,
      text,
      html,
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to send verification email:', error)
    }
    return user
  }
  return user
}

export async function verifyEmail({ email, code, res }) {
  const user = (await prisma.user.findUnique({ where: { email } })) as any
  if (!user) {
    throw new Error('User not found')
  }

  if (user.isVerified) {
    // If already verified, just return tokens
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: "1d" }
    );
    const refresh_token = jwt.sign(
      {
        userId: user.id,
      },
      REFRESH_SECRET,
      { expiresIn: "7d" }
    );
    res.cookie("jid", refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/graphql"
    })
    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token, refresh_token };
  }

  if (user.verificationCode !== code) {
    throw new Error('Invalid verification code')
  }

  const updatedUser = await prisma.user.update({
    where: { email },
    data: {
      isVerified: true,
      verificationCode: null,
    } as any,
  }) as any

  // Generate tokens for the verified user
  const token = jwt.sign(
    {
      userId: updatedUser.id,
      role: updatedUser.role,
      email: updatedUser.email
    },
    JWT_SECRET,
    { expiresIn: "1d" }
  );
  const refresh_token = jwt.sign(
    {
      userId: updatedUser.id,
    },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );
  res.cookie("jid", refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/graphql"
  })

  const { password: __, ...userWithoutPassword } = updatedUser;
  return { user: userWithoutPassword, token, refresh_token };
}

export async function resendOTP({ email }) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw new Error('User not found')
  }

  if (user.isVerified) {
    throw new Error('User is already verified')
  }

  const verificationCode = generateOTP()

  // Update user with new verification code
  await prisma.user.update({
    where: { email },
    data: {
      verificationCode,
    } as any,
  })

  // Send OTP email
  const subject = 'Verify your account'
  const text = `Your verification code is: ${verificationCode}`
  const html = `<p>Your verification code is: <strong>${verificationCode}</strong></p>`

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject,
      text,
      html,
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to send verification email:', error)
    }
    throw new Error('Failed to send verification email')
  }

  return { message: 'OTP sent successfully' }
}
