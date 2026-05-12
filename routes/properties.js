// FILE: bucketlist-backend/routes/properties.js

const express = require('express');
const router = express.Router();
const supabase = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// GET /api/properties — public
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        reviews(rating)
      `)
      .eq('is_available', true)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Calculate average rating for each property
    const properties = data.map(p => {
      const ratings = p.reviews || [];
      const avg = ratings.length > 0
        ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10) / 10
        : 0;
      const { reviews, ...rest } = p;
      return { ...rest, average_rating: avg, total_reviews: ratings.length };
    });

    res.json(properties);
  } catch (err) {
    console.error('Get properties error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/properties/:id — public
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select(`*, reviews(rating)`)
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    const ratings = data.reviews || [];
    const avg = ratings.length > 0
      ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10) / 10
      : 0;
    const { reviews, ...rest } = data;

    res.json({ ...rest, average_rating: avg, total_reviews: ratings.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/properties — admin only
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, location, description, price_per_night, bedrooms,
          bathrooms, max_guests, amenities, cover_image, images, airbnb_url } = req.body;

  if (!name || !location || !price_per_night) {
    return res.status(400).json({ error: 'name, location and price_per_night are required.' });
  }

  try {
    const { data, error } = await supabase
      .from('properties')
      .insert([{
        name, location, description: description || null,
        price_per_night, bedrooms: bedrooms || 1,
        bathrooms: bathrooms || 1, max_guests: max_guests || 2,
        amenities: amenities || [], cover_image: cover_image || null,
        images: images || [], airbnb_url: airbnb_url || null
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Property created.', property: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/properties/:id — admin only
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const updates = {};
  const fields = ['name', 'location', 'description', 'price_per_night', 'bedrooms',
                  'bathrooms', 'max_guests', 'amenities', 'cover_image',
                  'images', 'airbnb_url', 'is_available'];

  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  try {
    const { data, error } = await supabase
      .from('properties')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    res.json({ message: 'Property updated.', property: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;