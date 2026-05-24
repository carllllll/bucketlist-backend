// ================================================
// FILE LOCATION: bucketlist-backend/config/resend.js
// PURPOSE: Send booking alerts and confirmations via Resend
// ================================================

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// NOTE: onboarding@resend.dev can only deliver to your Resend account email.
// Once you have a real domain, update both FROM_EMAIL and OWNER_EMAIL.
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'carlllmugo@gmail.com'; // Your Resend account email
const FROM_EMAIL  = 'Bucketlist Staycations <onboarding@resend.dev>';

// =============================================
// NOTIFY OWNER — New Booking
// =============================================
const notifyOwnerNewBooking = async ({ guestName, guestEmail, guestPhone, propertyName, checkIn, checkOut, nights, total, bookingId }) => {
  try {
    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      OWNER_EMAIL,
      subject: `🏡 New Booking — ${propertyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #5a6e2a; padding: 24px 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🏡 New Booking Received</h1>
          </div>
          <div style="background: #f9faf5; padding: 30px; border-radius: 0 0 10px 10px;">

            <div style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #d4e0a8;">
              <h2 style="color: #3d4a1e; margin: 0 0 16px 0; font-size: 18px;">📋 Booking Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Property</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${propertyName}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-in</td><td style="padding: 8px 0; color: #1a2008;">${checkIn}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-out</td><td style="padding: 8px 0; color: #1a2008;">${checkOut}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Nights</td><td style="padding: 8px 0; color: #1a2008;">${nights}</td></tr>
                <tr style="border-top: 1px solid #d4e0a8;">
                  <td style="padding: 12px 0 8px; color: #5a6e2a; font-weight: bold;">Total Amount</td>
                  <td style="padding: 12px 0 8px; color: #5a6e2a; font-weight: bold; font-size: 18px;">KES ${Number(total).toLocaleString()}</td>
                </tr>
              </table>
            </div>

            <div style="background: white; border-radius: 10px; padding: 20px; border: 1px solid #d4e0a8;">
              <h2 style="color: #3d4a1e; margin: 0 0 16px 0; font-size: 18px;">👤 Guest Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Name</td><td style="padding: 8px 0; color: #1a2008;">${guestName}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Email</td><td style="padding: 8px 0; color: #1a2008;"><a href="mailto:${guestEmail}">${guestEmail}</a></td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Phone</td><td style="padding: 8px 0; color: #1a2008;">${guestPhone || 'Not provided'}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Booking ID</td><td style="padding: 8px 0; color: #1a2008; font-size: 12px;">${bookingId}</td></tr>
              </table>
            </div>

            <p style="color: #7a8c50; font-size: 13px; margin-top: 20px; text-align: center;">
              ⏳ Payment is pending. Booking will be confirmed once payment is received.
            </p>
          </div>
        </div>
      `
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
    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      OWNER_EMAIL, // onboarding@resend.dev can only send to Resend account email
      subject: `[GUEST: ${guestEmail}] Booking request — ${propertyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #5a6e2a; padding: 24px 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🏡 Bucketlist Staycations</h1>
          </div>
          <div style="background: #f9faf5; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="color: #e65c00; font-weight: bold;">⚠️ Test mode: This email was meant for guest ${guestName} (${guestEmail}). Add a real domain to send directly to guests.</p>
            <h2 style="color: #3d4a1e;">Hi ${guestName}! 👋</h2>
            <p style="color: #4a5a25; line-height: 1.7;">
              Your booking request for <strong>${propertyName}</strong> has been received.
              Please complete your M-Pesa payment to confirm your stay.
            </p>

            <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #d4e0a8;">
              <h3 style="color: #3d4a1e; margin: 0 0 16px 0;">📋 Your Booking</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Property</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${propertyName}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-in</td><td style="padding: 8px 0; color: #1a2008;">${checkIn}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-out</td><td style="padding: 8px 0; color: #1a2008;">${checkOut}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Nights</td><td style="padding: 8px 0; color: #1a2008;">${nights}</td></tr>
                <tr style="border-top: 1px solid #d4e0a8;">
                  <td style="padding: 12px 0 8px; color: #5a6e2a; font-weight: bold;">Total</td>
                  <td style="padding: 12px 0 8px; color: #5a6e2a; font-weight: bold; font-size: 18px;">KES ${Number(total).toLocaleString()}</td>
                </tr>
              </table>
            </div>

            <p style="color: #7a8c50; font-size: 13px; text-align: center;">
              Questions? Contact us at <a href="mailto:${OWNER_EMAIL}" style="color: #7a9b35;">${OWNER_EMAIL}</a>
              or WhatsApp <a href="https://wa.me/254716564174" style="color: #7a9b35;">+254 716 564 174</a>
            </p>
          </div>
        </div>
      `
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
    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      OWNER_EMAIL,
      subject: `✅ Payment Confirmed — ${propertyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #276749; padding: 24px 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">✅ Payment Confirmed!</h1>
          </div>
          <div style="background: #f9faf5; padding: 30px; border-radius: 0 0 10px 10px;">
            <div style="background: white; border-radius: 10px; padding: 20px; border: 1px solid #d4e0a8;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Property</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${propertyName}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Guest</td><td style="padding: 8px 0; color: #1a2008;">${guestName}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Phone</td><td style="padding: 8px 0; color: #1a2008;">${guestPhone}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-in</td><td style="padding: 8px 0; color: #1a2008;">${checkIn}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-out</td><td style="padding: 8px 0; color: #1a2008;">${checkOut}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">M-Pesa Receipt</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${mpesaReceipt || 'N/A'}</td></tr>
                <tr style="border-top: 1px solid #d4e0a8;">
                  <td style="padding: 12px 0 8px; color: #276749; font-weight: bold;">Amount Paid</td>
                  <td style="padding: 12px 0 8px; color: #276749; font-weight: bold; font-size: 18px;">KES ${Number(total).toLocaleString()}</td>
                </tr>
              </table>
            </div>
          </div>
        </div>
      `
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
    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      OWNER_EMAIL, // onboarding@resend.dev can only send to Resend account email
      subject: `[GUEST: ${guestEmail}] ✅ Booking Confirmed — ${propertyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #276749; padding: 24px 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">✅ Booking Confirmed!</h1>
          </div>
          <div style="background: #f9faf5; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="color: #e65c00; font-weight: bold;">⚠️ Test mode: This email was meant for guest ${guestName} (${guestEmail}). Add a real domain to send directly to guests.</p>
            <h2 style="color: #3d4a1e;">You're all set, ${guestName}! 🎉</h2>
            <p style="color: #4a5a25; line-height: 1.7;">
              Your payment has been received and your stay at <strong>${propertyName}</strong> is confirmed.
            </p>

            <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #d4e0a8;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Property</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${propertyName}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-in</td><td style="padding: 8px 0; color: #1a2008; font-weight: bold;">${checkIn}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Check-out</td><td style="padding: 8px 0; color: #1a2008;">${checkOut}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">Nights</td><td style="padding: 8px 0; color: #1a2008;">${nights}</td></tr>
                <tr><td style="padding: 8px 0; color: #7a8c50; font-size: 14px;">M-Pesa Receipt</td><td style="padding: 8px 0; color: #1a2008;">${mpesaReceipt || 'N/A'}</td></tr>
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
              Bucketlist Staycations — ${OWNER_EMAIL}
            </p>
          </div>
        </div>
      `
    });
    console.log('✅ Guest confirmation email sent');
  } catch (err) {
    console.error('Guest confirmation email error:', err.message);
  }
};

module.exports = {
  notifyOwnerNewBooking,
  notifyGuestBookingCreated,
  notifyOwnerPaymentConfirmed,
  notifyGuestPaymentConfirmed
};