// FILE: bucketlist-backend/routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../config/email');

// =============================================
// REGISTER
// POST /api/auth/register
// =============================================
router.post('/register', async (req, res) => {
  const { full_name, email, phone, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Full name, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    // Check if email exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const verification_token = crypto.randomBytes(32).toString('hex');

    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        full_name,
        email,
        phone: phone || null,
        password_hash,
        email_verified: false,
        verification_token
      }])
      .select('id, full_name, email, phone, role, email_verified, created_at')
      .single();

    if (error) throw error;

    // Send verification email
    try {
      await sendVerificationEmail(email, full_name, verification_token);
    } catch (emailErr) {
      console.error('Email send error:', emailErr.message);
      // Don't fail registration if email fails — just log it
    }

    res.status(201).json({
      message: 'Account created! Please check your email to verify your account before booking.',
      user
    });

  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// =============================================
// VERIFY EMAIL
// GET /api/auth/verify-email?token=xxx
// =============================================
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('<h2>Invalid verification link.</h2>');
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email_verified')
      .eq('verification_token', token)
      .single();

    if (error || !user) {
      return res.status(400).send('<h2>Invalid or expired verification link.</h2>');
    }

    if (user.email_verified) {
      return res.redirect(`${process.env.FRONTEND_URL}?verified=already`);
    }

    await supabase
      .from('users')
      .update({ email_verified: true, verification_token: null })
      .eq('id', user.id);

    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL}?verified=true`);

  } catch (err) {
    res.status(500).send('<h2>Server error. Please try again.</h2>');
  }
});

// =============================================
// LOGIN
// POST /api/auth/login
// =============================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check email verified
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in. Check your inbox.',
        unverified: true
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password_hash, verification_token, reset_token, reset_token_expires, ...userSafe } = user;
    res.json({ message: 'Login successful.', token, user: userSafe });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// =============================================
// RESEND VERIFICATION EMAIL
// POST /api/auth/resend-verification
// =============================================
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, full_name, email_verified, verification_token')
      .eq('email', email)
      .single();

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If that email exists, a verification link has been sent.' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'This email is already verified.' });
    }

    const verification_token = crypto.randomBytes(32).toString('hex');

    await supabase
      .from('users')
      .update({ verification_token })
      .eq('id', user.id);

    await sendVerificationEmail(email, user.full_name, verification_token);

    res.json({ message: 'Verification email sent. Please check your inbox.' });

  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// =============================================
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// =============================================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('email', email)
      .single();

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const reset_token = crypto.randomBytes(32).toString('hex');
    const reset_token_expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await supabase
      .from('users')
      .update({ reset_token, reset_token_expires })
      .eq('id', user.id);

    await sendPasswordResetEmail(email, user.full_name, reset_token);

    res.json({ message: 'If that email exists, a reset link has been sent.' });

  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// =============================================
// RESET PASSWORD
// POST /api/auth/reset-password
// =============================================
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, reset_token_expires')
      .eq('reset_token', token)
      .single();

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    }

    // Check token expiry
    if (new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await supabase
      .from('users')
      .update({
        password_hash,
        reset_token: null,
        reset_token_expires: null
      })
      .eq('id', user.id);

    res.json({ message: 'Password reset successfully. You can now log in.' });

  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// =============================================
// GET CURRENT USER
// GET /api/auth/me
// =============================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, role, email_verified, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// =============================================
// UPDATE PROFILE
// PUT /api/auth/profile
// =============================================
router.put('/profile', authMiddleware, async (req, res) => {
  const { full_name, phone } = req.body;
  try {
    const updates = {};
    if (full_name) updates.full_name = full_name;
    if (phone) updates.phone = phone;

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, full_name, email, phone, role, email_verified, created_at')
      .single();

    if (error) throw error;
    res.json({ message: 'Profile updated.', user });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;