// FILE: bucketlist-backend/routes/payments.js

const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const INTASEND_BASE = process.env.INTASEND_ENV === 'production'
  ? 'https://payment.intasend.com/api/v1'
  : 'https://sandbox.intasend.com/api/v1';

// POST /api/payments/initiate
router.post('/initiate', authMiddleware, async (req, res) => {
  const { booking_id, phone_number } = req.body;

  if (!booking_id || !phone_number) {
    return res.status(400).json({ error: 'booking_id and phone_number are required.' });
  }

  try {
    // Get booking
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

    // Normalize phone number to 2547XXXXXXXX
    let phone = phone_number.toString().replace(/\s+/g, '');
    if (phone.startsWith('07') || phone.startsWith('01')) {
      phone = '254' + phone.substring(1);
    }
    if (phone.startsWith('+')) {
      phone = phone.substring(1);
    }

    // Intasend STK Push
    const response = await axios.post(
      `${INTASEND_BASE}/payment/mpesa-stk-push/`,
      {
        amount: Math.round(booking.total_amount),
        phone_number: phone,
        api_ref: `BKT-${booking.id.substring(0, 8).toUpperCase()}`,
        narrative: 'Bucketlist Staycations Payment'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.INTASEND_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const intasend_ref = response.data?.invoice?.invoice_id
      || response.data?.id
      || null;

    // Save payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([{
        booking_id: booking.id,
        user_id: req.user.id,
        amount: booking.total_amount,
        phone_number: phone,
        instasend_ref: intasend_ref
      }])
      .select()
      .single();

    if (paymentError) throw paymentError;

    res.status(201).json({
      message: 'STK Push sent to your phone. Enter your M-Pesa PIN to complete payment.',
      payment
    });

  } catch (err) {
    console.error('Payment error:', err.response?.data || err.message);
    res.status(502).json({
      error: 'Payment could not be initiated. Please try again.',
      details: err.response?.data || err.message
    });
  }
});

// POST /api/payments/webhook — Intasend calls this after payment
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log('Webhook received:', JSON.stringify(body));

    // Intasend webhook payload
    const invoice_id = body?.invoice?.invoice_id || body?.invoice_id || body?.id;
    const state = body?.invoice?.state || body?.state;

    if (!invoice_id) {
      return res.status(400).json({ error: 'Invalid webhook payload.' });
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('instasend_ref', invoice_id)
      .single();

    if (!payment) {
      return res.json({ message: 'Payment not found, ignoring.' });
    }

    if (state === 'COMPLETE') {
      await supabase
        .from('payments')
        .update({ status: 'success', paid_at: new Date().toISOString() })
        .eq('id', payment.id);

      await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', payment.booking_id);

      console.log(`✅ Payment confirmed for booking ${payment.booking_id}`);

    } else if (state === 'FAILED' || state === 'CANCELLED') {
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id);

      console.log(`❌ Payment ${state} for booking ${payment.booking_id}`);
    }

    res.json({ message: 'Webhook received.' });

  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/payments/:booking_id — check payment status
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