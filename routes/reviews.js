// FILE: bucketlist-backend/routes/reviews.js

const express = require('express');
const router = express.Router();
const supabase = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// POST /api/reviews — verified guests only
router.post('/', authMiddleware, async (req, res) => {
  const { booking_id, rating, comment } = req.body;

  if (!booking_id || !rating) {
    return res.status(400).json({ error: 'booking_id and rating are required.' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }

  try {
    // Verify booking belongs to user and is confirmed/completed
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('user_id', req.user.id)
      .in('status', ['confirmed', 'completed'])
      .single();

    if (!booking) {
      return res.status(403).json({
        error: 'You can only review properties you have stayed at.'
      });
    }

    // Check if already reviewed
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', booking_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this stay.' });
    }

    // Insert review
    const { data: review, error } = await supabase
      .from('reviews')
      .insert([{
        booking_id,
        user_id: req.user.id,
        property_id: booking.property_id,
        rating,
        comment: comment || null
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Thank you for your review!',
      review
    });

  } catch (err) {
    console.error('Review error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reviews/:property_id — public
router.get('/:property_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id, rating, comment, created_at,
        users(full_name)
      `)
      .eq('property_id', req.params.property_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const reviews = data.map(r => ({
      ...r,
      guest_name: r.users?.full_name,
      users: undefined
    }));

    const average = reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

    res.json({
      reviews,
      average_rating: average,
      total_reviews: reviews.length
    });

  } catch (err) {
    console.error('Get reviews error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;