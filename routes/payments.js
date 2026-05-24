// ================================================
// FILE LOCATION: bucketlist-backend/routes/payments.js
// PURPOSE: M-Pesa Daraja API — STK Push, Callback, Status
// ================================================

const express = require('express');
const router = express.Router();
const https = require('https');
const supabase = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { notifyOwnerPaymentConfirmed, notifyGuestPaymentConfirmed } = require('../config/resend');

// ─── DARAJA HELPERS ──────────────────────────────────────────────────────────

const DARAJA_BASE =
  process.env.MPESA_ENV === 'production'
    ? 'api.safaricom.co.ke'
    : 'sandbox.safaricom.co.ke';

/** Get OAuth access token from Daraja */
function getDarajaToken() {
  return new Promise((resolve, reject) => {
    const credentials = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    const options = {
      hostname: DARAJA_BASE,
      path: '/oauth/v1/generate?grant_type=client_credentials',
      method: 'GET',
      headers: { Authorization: `Basic ${credentials}` },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) resolve(parsed.access_token);
          else reject(new Error('Token error: ' + data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/** Generate Daraja timestamp (YYYYMMDDHHmmss) */
function getTimestamp() {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')
  );
}

/** Send STK Push request */
function sendStkPush(accessToken, { phone, amount, reference, description }) {
  return new Promise((resolve, reject) => {
    const timestamp = getTimestamp();
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const payload = JSON.stringify({
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: reference,
      TransactionDesc: description,
    });

    const options = {
      hostname: DARAJA_BASE,
      path: '/mpesa/stkpush/v1/processrequest',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/** Normalize phone to 254XXXXXXXXX */
function normalizePhone(raw) {
  let phone = raw.toString().replace(/\s+/g, '');
  if (phone.startsWith('07') || phone.startsWith('01')) {
    phone = '254' + phone.substring(1);
  }
  if (phone.startsWith('+')) {
    phone = phone.substring(1);
  }
  return phone;
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// POST /api/payments/initiate
router.post('/initiate', authMiddleware, async (req, res) => {
  const { booking_id, phone_number } = req.body;

  if (!booking_id || !phone_number) {
    return res.status(400).json({ error: 'booking_id and phone_number are required.' });
  }

  try {
    // Fetch booking (must belong to logged-in user)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('user_id', req.user.id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.status === 'confirmed') {
      return res.status(400).json({ error: 'This booking has already been paid for.' });
    }

    const phone = normalizePhone(phone_number);
    const reference = `BKT-${booking.id.substring(0, 8).toUpperCase()}`;

    // Get Daraja token and trigger STK Push
    const accessToken = await getDarajaToken();
    const stkResponse = await sendStkPush(accessToken, {
      phone,
      amount: booking.total_amount,
      reference,
      description: `Payment for booking ${reference}`,
    });

    if (stkResponse.ResponseCode !== '0') {
      console.error('STK Push rejected:', stkResponse);
      return res.status(502).json({
        error: 'M-Pesa could not process the request. Please try again.',
        details: stkResponse.ResponseDescription || stkResponse.errorMessage,
      });
    }

    const mpesa_ref = stkResponse.CheckoutRequestID;

    // Save payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([{
        booking_id: booking.id,
        user_id: req.user.id,
        amount: booking.total_amount,
        phone_number: phone,
        instasend_ref: mpesa_ref,
        status: 'pending',
      }])
      .select()
      .single();

    if (paymentError) throw paymentError;

    res.status(201).json({
      message: 'STK Push sent to your phone. Enter your M-Pesa PIN to complete payment.',
      payment,
      checkout_request_id: mpesa_ref,
    });

  } catch (err) {
    console.error('Payment error:', err?.message || err);
    res.status(502).json({
      error: 'Payment could not be initiated. Please try again.',
      details: err?.message,
    });
  }
});

// POST /api/payments/webhook
// Safaricom calls this after customer completes or cancels payment
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log('M-Pesa Callback received:', JSON.stringify(body));

    const callback = body?.Body?.stkCallback;

    if (!callback) {
      return res.status(400).json({ error: 'Invalid callback payload.' });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;

    // Find payment by CheckoutRequestID
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('instasend_ref', checkoutRequestId)
      .single();

    if (!payment) {
      console.log('Payment not found for CheckoutRequestID:', checkoutRequestId);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (resultCode === 0) {
      // Extract M-Pesa receipt number
      const items = callback?.CallbackMetadata?.Item || [];
      const mpesaReceiptItem = items.find((i) => i.Name === 'MpesaReceiptNumber');
      const mpesaReceipt = mpesaReceiptItem?.Value || null;

      await supabase
        .from('payments')
        .update({ status: 'success', paid_at: new Date().toISOString() })
        .eq('id', payment.id);

      await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', payment.booking_id);

      console.log(`✅ Booking ${payment.booking_id} confirmed. Receipt: ${mpesaReceipt}`);

      // Send confirmation emails (non-blocking)
      try {
        const { data: booking } = await supabase
          .from('bookings')
          .select('*, properties(name)')
          .eq('id', payment.booking_id)
          .single();

        const { data: guest } = await supabase
          .from('users')
          .select('full_name, email, phone')
          .eq('id', payment.user_id)
          .single();

        if (booking && guest) {
          notifyOwnerPaymentConfirmed({
            guestName:    guest.full_name,
            guestPhone:   payment.phone_number,
            propertyName: booking.properties?.name || 'Property',
            checkIn:      booking.check_in,
            checkOut:     booking.check_out,
            total:        payment.amount,
            mpesaReceipt
          });

          notifyGuestPaymentConfirmed({
            guestName:    guest.full_name,
            guestEmail:   guest.email,
            propertyName: booking.properties?.name || 'Property',
            checkIn:      booking.check_in,
            checkOut:     booking.check_out,
            nights:       booking.nights,
            total:        payment.amount,
            mpesaReceipt
          });
        }
      } catch (emailErr) {
        console.error('Confirmation email error:', emailErr.message);
      }

    } else {
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id);

      console.log(`❌ Payment failed. ResultCode: ${resultCode} — ${callback.ResultDesc}`);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/payments/:booking_id
router.get('/:booking_id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', req.params.booking_id)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'No payment found for this booking.' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;