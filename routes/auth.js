// FILE: bucketlist-backend/routes/auth.js
// Uses Supabase Auth for email verification and password reset

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const supabase = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// Supabase Auth client (uses anon key for auth operations)
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =============================================
// REGISTER
// POST /api/auth/register
// Supabase sends verification email automatically
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
    // Register with Supabase Auth — this sends verification email automatically
    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, phone: phone || null },
        emailRedirectTo: `${process.env.FRONTEND_URL}?verified=true`
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return res.status(400).json({ error: 'An account with this email already exists.' });
      }
      throw authError;
    }

    // Also save to our users table with the same UUID from Supabase Auth
    const { error: dbError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        full_name,
        email,
        phone: phone || null,
        password_hash: 'supabase_auth', // managed by Supabase Auth
        role: 'guest',
        email_verified: false
      }]);

    // Ignore duplicate key error (user might already exist in our table)
    if (dbError && !dbError.message.includes('duplicate')) {
      console.error('DB insert error:', dbError.message);
    }

    res.status(201).json({
      message: 'Account created! Please check your email and click the verification link before logging in.'
    });

  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
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
    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      if (authError.message.includes('Email not confirmed')) {
        return res.status(403).json({
          error: 'Please verify your email before logging in. Check your inbox.',
          unverified: true
        });
      }
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Get user from our users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email, phone, role, created_at')
      .eq('id', authData.user.id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    // Update email_verified in our table
    await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', user.id);

    // Generate our JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ message: 'Login successful.', token, user });

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
    const { error } = await supabaseAuth.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}?verified=true`
      }
    });

    if (error) throw error;

    res.json({ message: 'Verification email sent. Please check your inbox.' });

  } catch (err) {
    console.error('Resend error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// =============================================
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// Supabase sends reset email automatically
// =============================================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password.html`
    });

    if (error) throw error;

    // Always return success to prevent email enumeration
    res.json({ message: 'If that email exists, a password reset link has been sent.' });

  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// =============================================
// RESET PASSWORD
// POST /api/auth/reset-password
// Called from the reset password page with new password
// =============================================
router.post('/reset-password', async (req, res) => {
  const { access_token, password } = req.body;

  if (!access_token || !password) {
    return res.status(400).json({ error: 'Access token and new password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    // Set the session using the token from the reset link
    const { error: sessionError } = await supabaseAuth.auth.setSession({
      access_token,
      refresh_token: access_token
    });

    if (sessionError) throw sessionError;

    // Update the password
    const { error: updateError } = await supabaseAuth.auth.updateUser({
      password
    });

    if (updateError) throw updateError;

    res.json({ message: 'Password reset successfully. You can now log in.' });

  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Invalid or expired reset link. Please request a new one.' });
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
      .select('id, full_name, email, phone, role, created_at')
      .single();

    if (error) throw error;
    res.json({ message: 'Profile updated.', user });

  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;