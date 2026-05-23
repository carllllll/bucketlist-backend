// ================================================
// FILE LOCATION: bucketlist-backend/config/email.js
// PURPOSE: Send verification and reset emails
// ================================================

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS  // Gmail App Password (not your real password)
  }
});

const sendVerificationEmail = async (email, full_name, token) => {
  const verifyUrl = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"Bucketlist Staycations" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify your Bucketlist Staycations account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5a6e2a; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🏡 Bucketlist Staycations</h1>
        </div>
        <div style="background: #f9faf5; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #3d4a1e;">Hi ${full_name}! 👋</h2>
          <p style="color: #4a5a25; line-height: 1.7;">
            Thank you for creating an account. Please verify your email address to start booking.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}"
               style="background: #7a9b35; color: white; padding: 14px 32px;
                      border-radius: 8px; text-decoration: none; font-weight: bold;
                      font-size: 16px;">
              Verify My Email
            </a>
          </div>
          <p style="color: #7a8c50; font-size: 13px;">
            This link expires in 24 hours. If you didn't create an account, ignore this email.
          </p>
        </div>
      </div>
    `
  });
};

const sendPasswordResetEmail = async (email, full_name, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

  await transporter.sendMail({
    from: `"Bucketlist Staycations" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset your Bucketlist Staycations password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5a6e2a; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🏡 Bucketlist Staycations</h1>
        </div>
        <div style="background: #f9faf5; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #3d4a1e;">Hi ${full_name},</h2>
          <p style="color: #4a5a25; line-height: 1.7;">
            We received a request to reset your password. Click the button below to set a new one.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background: #7a9b35; color: white; padding: 14px 32px;
                      border-radius: 8px; text-decoration: none; font-weight: bold;
                      font-size: 16px;">
              Reset My Password
            </a>
          </div>
          <p style="color: #7a8c50; font-size: 13px;">
            This link expires in 1 hour. If you didn't request a reset, ignore this email.
          </p>
        </div>
      </div>
    `
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };