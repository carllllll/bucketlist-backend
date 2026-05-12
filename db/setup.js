// ================================================
// FILE LOCATION: bucketlist-backend/db/setup.js
// PURPOSE: Creates all database tables in Supabase
// RUN ONCE with: node db/setup.js
// ================================================

const pool = require('../config/db');

const createTables = async () => {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    console.log('✅ UUID extension ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        full_name     VARCHAR(100) NOT NULL,
        email         VARCHAR(150) UNIQUE NOT NULL,
        phone         VARCHAR(20),
        password_hash TEXT NOT NULL,
        role          VARCHAR(20) DEFAULT 'guest' CHECK (role IN ('guest','admin')),
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Users table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name            VARCHAR(200) NOT NULL,
        location        VARCHAR(255) NOT NULL,
        description     TEXT,
        price_per_night NUMERIC(10,2) NOT NULL,
        bedrooms        INT DEFAULT 1,
        bathrooms       NUMERIC(3,1) DEFAULT 1,
        max_guests      INT DEFAULT 2,
        amenities       TEXT[],
        cover_image     VARCHAR(500),
        images          TEXT[],
        airbnb_url      TEXT,
        is_available    BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Properties table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        check_in      DATE NOT NULL,
        check_out     DATE NOT NULL,
        guests_count  INT DEFAULT 1,
        total_amount  NUMERIC(10,2) NOT NULL,
        nights        INT NOT NULL,
        status        VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','cancelled','completed')),
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT valid_dates CHECK (check_out > check_in)
      );
    `);
    console.log('✅ Bookings table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id     UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        user_id        UUID NOT NULL REFERENCES users(id),
        amount         NUMERIC(10,2) NOT NULL,
        phone_number   VARCHAR(20) NOT NULL,
        instasend_ref  VARCHAR(200),
        status         VARCHAR(20) DEFAULT 'pending'
                         CHECK (status IN ('pending','success','failed')),
        paid_at        TIMESTAMPTZ,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Payments table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id  UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id),
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment     TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Reviews table ready');

    await pool.query(`
      CREATE OR REPLACE FUNCTION check_booking_overlap()
      RETURNS TRIGGER AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM bookings
          WHERE property_id = NEW.property_id
            AND status NOT IN ('cancelled')
            AND id != NEW.id
            AND check_in  < NEW.check_out
            AND check_out > NEW.check_in
        ) THEN
          RAISE EXCEPTION 'Property already booked for these dates';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS prevent_double_booking ON bookings;

      CREATE TRIGGER prevent_double_booking
        BEFORE INSERT OR UPDATE ON bookings
        FOR EACH ROW EXECUTE FUNCTION check_booking_overlap();
    `);
    console.log('✅ Double booking prevention trigger ready');

    console.log('\n🎉 All tables created successfully! You can now run the server.');

  } catch (err) {
    console.error('❌ Setup failed:', err.message);
  } finally {
    process.exit();
  }
};

createTables();