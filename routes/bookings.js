// FILE: bucketlist-backend/routes/bookings.js

const express = require('express');
const router = express.Router();
const supabase = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/bookings/availability — public
router.get('/availability', async (req, res) => {
  const { property_id, check_in, check_out } = req.query;

  if (!property_id || !check_in || !check_out) {
    return res.status(400).json({ error: 'property_id, check_in and check_out are required.' });
  }

  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('property_id', property_id)
      .not('status', 'eq', 'cancelled')
      .lt('check_in', check_out)
      .gt('check_out', check_in);

    if (error) throw error;

    res.json({
      available: data.length === 0,
      property_id,
      check_in,
      check_out
    });
  } catch (err) {
    console.error('Availability error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/bookings — requires login
router.post('/', authMiddleware, async (req, res) => {
  const { property_id, check_in, check_out, guests_count } = req.body;

  if (!property_id || !check_in || !check_out) {
    return res.status(400).json({ error: 'property_id, check_in and check_out are required.' });
  }

  try {
    // Get property
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, name, price_per_night, is_available')
      .eq('id', property_id)
      .single();

    if (propError || !property) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    if (!property.is_available) {
      return res.status(400).json({ error: 'Property is not available.' });
    }

    // Calculate nights and total
    const nights = Math.ceil(
      (new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24)
    );

    if (nights <= 0) {
      return res.status(400).json({ error: 'Check-out must be after check-in.' });
    }

    const total_amount = nights * parseFloat(property.price_per_night);

    // Check availability again before inserting
    const { data: conflict } = await supabase
      .from('bookings')
      .select('id')
      .eq('property_id', property_id)
      .not('status', 'eq', 'cancelled')
      .lt('check_in', check_out)
      .gt('check_out', check_in);

    if (conflict && conflict.length > 0) {
      return res.status(409).json({
        error: 'Sorry, this property is already booked for these dates. Please choose different dates.'
      });
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([{
        property_id,
        user_id: req.user.id,
        check_in,
        check_out,
        guests_count: guests_count || 1,
        total_amount,
        nights,
        status: 'pending'
      }])
      .select()
      .single();

    if (bookingError) throw bookingError;

    res.status(201).json({
      message: 'Booking created. Complete payment to confirm your stay.',
      booking
    });

  } catch (err) {
    console.error('Booking error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/bookings/my — get logged in user's bookings
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        properties(name, location, cover_image)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Flatten the joined data
    const bookings = data.map(b => ({
      ...b,
      property_name: b.properties?.name,
      property_location: b.properties?.location,
      property_image: b.properties?.cover_image,
      properties: undefined
    }));

    res.json(bookings);
  } catch (err) {
    console.error('Get bookings error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/bookings/:id — single booking
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`*, properties(name, location, cover_image, price_per_night)`)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const result = {
      ...data,
      property_name: data.properties?.name,
      property_location: data.properties?.location,
      property_image: data.properties?.cover_image,
      property_price: data.properties?.price_per_night,
      properties: undefined
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/bookings/:id/cancel
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    // First verify booking belongs to user and is cancellable
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (['cancelled', 'completed'].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot cancel a ${booking.status} booking.` });
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Booking cancelled successfully.', booking: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;