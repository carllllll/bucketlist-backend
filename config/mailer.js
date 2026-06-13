// ================================================
// FILE LOCATION: bucketlist-backend/config/mailer.js
// PURPOSE: Send all emails via the Brevo HTTP API (port 443)
//   Render blocks outbound SMTP ports, so we use HTTPS instead of nodemailer.
//   - Verification emails (to the guest)
//   - Booking + payment alerts (owner + guest)
// Requires env:
//   BREVO_API_KEY  — Brevo (sendinblue) API key
//   SENDER_EMAIL   — a sender address verified in Brevo (e.g. your Gmail)
//   OWNER_EMAIL    — where owner alerts go (defaults to SENDER_EMAIL)
// ================================================

const SENDER_EMAIL = process.env.SENDER_EMAIL || process.env.EMAIL_USER;
const SENDER_NAME  = 'Bucketlist Staycations';
const OWNER_EMAIL  = process.env.OWNER_EMAIL || SENDER_EMAIL;

// Send one email through Brevo's transactional API over HTTPS
async function sendEmail({ to, toName, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [toName ? { email: to, name: toName } : { email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${detail}`);
  }
}

// Escape user-supplied text before embedding it in email HTML (prevents HTML injection)
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

// =============================================
// VERIFICATION EMAIL — sent to the guest
// =============================================
const sendVerificationEmail = async (email, full_name, token) => {
  const verifyUrl = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${token}`;

  await sendEmail({
    to: email,
    toName: full_name,
    subject: 'Verify your Bucketlist Staycations account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7a9b35;">Welcome to Bucketlist Staycations! 🏡</h2>
        <p>Hi ${esc(full_name)},</p>
        <p>Thanks for creating an account. Please verify your email address by clicking the button below:</p>
        <a href="${verifyUrl}"
           style="display: inline-block; background: #7a9b35; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Verify Email Address
        </a>
        <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
        <p style="color: #666; font-size: 14px;">If you didn't create this account, you can ignore this email.</p>
      </div>
    `,
  });
};

// =============================================
// NOTIFY OWNER — New Booking
// =============================================
const notifyOwnerNewBooking = async ({ guestName, guestEmail, guestPhone, propertyName, checkIn, checkOut, nights, total, bookingId }) => {
  try {
    await sendEmail({
      to: OWNER_EMAIL,
      subject: `🏡 New Booking — ${esc(propertyName)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #5a6e2a; padding: 24px 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🏡 New Booking Received</h1>
          </div>
          <div style="background: #f9faf5; padding: 30px; border-radius: 0 0 10px 10px;">
            <div style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #d4e0a8;">
              <h2 style="color: #3d4a1e; margin: 0 0 16px 0; font-size: 18px;">📋 Booking Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Property</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${esc(propertyName)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-in</td><td style="padding: 8px 0; color: #1a2008;">${esc(checkIn)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-out</td><td style="padding: 8px 0; color: #1a2008;">${esc(checkOut)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Nights</td><td style="padding: 8px 0; color: #1a2008;">${esc(nights)}</td></tr>
                <tr style="border-top: 1px solid #d4e0a8;">
                  <td style="padding: 12px 0 8px; color: #5a6e2a; font-weight: bold;">Total Amount</td>
                  <td style="padding: 12px 0 8px; color: #5a6e2a; font-weight: bold; font-size: 18px;">KES ${Number(total).toLocaleString()}</td>
                </tr>
              </table>
            </div>
            <div style="background: white; border-radius: 10px; padding: 20px; border: 1px solid #d4e0a8;">
              <h2 style="color: #3d4a1e; margin: 0 0 16px 0; font-size: 18px;">👤 Guest Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Name</td><td style="padding: 8px 0; color: #1a2008;">${esc(guestName)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Email</td><td style="padding: 8px 0; color: #1a2008;">${esc(guestEmail)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Phone</td><td style="padding: 8px 0; color: #1a2008;">${esc(guestPhone) || 'Not provided'}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Booking ID</td><td style="padding: 8px 0; color: #1a2008; font-size: 12px;">${esc(bookingId)}</td></tr>
              </table>
            </div>
            <p style="color: #7a8c50; font-size: 13px; margin-top: 20px; text-align: center;">
              ⏳ Payment is pending. Booking will be confirmed once payment is received.
            </p>
          </div>
        </div>
      `,
    });
    console.log('✅ Owner booking alert sent');
  } catch (err) {
    console.error('Owner email error:', err.message);
  }
};

// =============================================
// NOTIFY GUEST — Booking Created
// =============================================
const notifyGuestBookingCreated = async ({ guestName, guestEmail, propertyName, checkIn, checkOut, nights, total, bookingId }) => {
  try {
    await sendEmail({
      to: guestEmail,
      toName: guestName,
      subject: `Booking request received — ${esc(propertyName)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #5a6e2a; padding: 24px 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🏡 Bucketlist Staycations</h1>
          </div>
          <div style="background: #f9faf5; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #3d4a1e;">Hi ${esc(guestName)}! 👋</h2>
            <p style="color: #4a5a25; line-height: 1.7;">
              Your booking request for <strong>${esc(propertyName)}</strong> has been received.
              Please complete your M-Pesa payment to confirm your stay.
            </p>
            <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #d4e0a8;">
              <h3 style="color: #3d4a1e; margin: 0 0 16px 0;">📋 Your Booking</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Property</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${esc(propertyName)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-in</td><td style="padding: 8px 0; color: #1a2008;">${esc(checkIn)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-out</td><td style="padding: 8px 0; color: #1a2008;">${esc(checkOut)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Nights</td><td style="padding: 8px 0; color: #1a2008;">${esc(nights)}</td></tr>
                <tr style="border-top: 1px solid #d4e0a8;">
                  <td style="padding: 12px 0 8px; color: #5a6e2a; font-weight: bold;">Total</td>
                  <td style="padding: 12px 0 8px; color: #5a6e2a; font-weight: bold; font-size: 18px;">KES ${Number(total).toLocaleString()}</td>
                </tr>
              </table>
            </div>
            <p style="color: #7a8c50; font-size: 13px; text-align: center;">
              Questions? Contact us at <a href="mailto:${esc(OWNER_EMAIL)}" style="color: #7a9b35;">${esc(OWNER_EMAIL)}</a>
              or WhatsApp <a href="https://wa.me/254716564174" style="color: #7a9b35;">+254 716 564 174</a>
            </p>
          </div>
        </div>
      `,
    });
    console.log('✅ Guest booking email sent');
  } catch (err) {
    console.error('Guest email error:', err.message);
  }
};

// =============================================
// NOTIFY OWNER — Payment Confirmed
// =============================================
const notifyOwnerPaymentConfirmed = async ({ guestName, guestPhone, propertyName, checkIn, checkOut, total, mpesaReceipt }) => {
  try {
    await sendEmail({
      to: OWNER_EMAIL,
      subject: `✅ Payment Confirmed — ${esc(propertyName)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #276749; padding: 24px 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">✅ Payment Confirmed!</h1>
          </div>
          <div style="background: #f9faf5; padding: 30px; border-radius: 0 0 10px 10px;">
            <div style="background: white; border-radius: 10px; padding: 20px; border: 1px solid #d4e0a8;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Property</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${esc(propertyName)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Guest</td><td style="padding: 8px 0; color: #1a2008;">${esc(guestName)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Phone</td><td style="padding: 8px 0; color: #1a2008;">${esc(guestPhone)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-in</td><td style="padding: 8px 0; color: #1a2008;">${esc(checkIn)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-out</td><td style="padding: 8px 0; color: #1a2008;">${esc(checkOut)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">M-Pesa Receipt</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${esc(mpesaReceipt) || 'N/A'}</td></tr>
                <tr style="border-top: 1px solid #d4e0a8;">
                  <td style="padding: 12px 0 8px; color: #276749; font-weight: bold;">Amount Paid</td>
                  <td style="padding: 12px 0 8px; color: #276749; font-weight: bold; font-size: 18px;">KES ${Number(total).toLocaleString()}</td>
                </tr>
              </table>
            </div>
          </div>
        </div>
      `,
    });
    console.log('✅ Payment confirmation email sent to owner');
  } catch (err) {
    console.error('Payment confirmation email error:', err.message);
  }
};

// =============================================
// NOTIFY GUEST — Payment Confirmed
// =============================================
const notifyGuestPaymentConfirmed = async ({ guestName, guestEmail, propertyName, checkIn, checkOut, nights, total, mpesaReceipt }) => {
  try {
    await sendEmail({
      to: guestEmail,
      toName: guestName,
      subject: `✅ Booking Confirmed — ${esc(propertyName)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #276749; padding: 24px 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">✅ Booking Confirmed!</h1>
          </div>
          <div style="background: #f9faf5; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #3d4a1e;">You're all set, ${esc(guestName)}! 🎉</h2>
            <p style="color: #4a5a25; line-height: 1.7;">
              Your payment has been received and your stay at <strong>${esc(propertyName)}</strong> is confirmed.
            </p>
            <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #d4e0a8;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Property</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${esc(propertyName)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-in</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${esc(checkIn)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-out</td><td style="padding: 8px 0; color: #1a2008;">${esc(checkOut)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Nights</td><td style="padding: 8px 0; color: #1a2008;">${esc(nights)}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">M-Pesa Receipt</td><td style="padding: 8px 0; color: #1a2008;">${esc(mpesaReceipt) || 'N/A'}</td></tr>
                <tr style="border-top: 1px solid #d4e0a8;">
                  <td style="padding: 12px 0 8px; color: #276749; font-weight: bold;">Amount Paid</td>
                  <td style="padding: 12px 0 8px; color: #276749; font-weight: bold; font-size: 18px;">KES ${Number(total).toLocaleString()}</td>
                </tr>
              </table>
            </div>
            <div style="text-align: center; margin-top: 24px;">
              <a href="https://wa.me/254716564174"
                 style="background: #25D366; color: white; padding: 12px 28px;
                        border-radius: 8px; text-decoration: none; font-weight: bold;">
                💬 WhatsApp Us
              </a>
            </div>
            <p style="color: #7a8c50; font-size: 13px; text-align: center; margin-top: 20px;">
              Bucketlist Staycations — ${esc(OWNER_EMAIL)}
            </p>
          </div>
        </div>
      `,
    });
    console.log('✅ Guest confirmation email sent');
  } catch (err) {
    console.error('Guest confirmation email error:', err.message);
  }
};

module.exports = {
  sendVerificationEmail,
  notifyOwnerNewBooking,
  notifyGuestBookingCreated,
  notifyOwnerPaymentConfirmed,
  notifyGuestPaymentConfirmed,
};
