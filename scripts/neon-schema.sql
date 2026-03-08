-- Neon PostgreSQL Schema for World Monitor
-- Run this in Neon SQL Editor: https://console.neon.tech

-- Registrations table (replaces Convex registrations)
CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    normalized_email VARCHAR(320) NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    source VARCHAR(100) DEFAULT 'unknown',
    app_version VARCHAR(100) DEFAULT 'unknown',
    referral_code VARCHAR(20),
    referred_by VARCHAR(20),
    referral_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on normalized email
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_normalized_email
    ON registrations(normalized_email);

-- Index for referral code lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_referral_code
    ON registrations(referral_code) WHERE referral_code IS NOT NULL;

-- Counters table (replaces Convex counters)
CREATE TABLE IF NOT EXISTS counters (
    name VARCHAR(100) PRIMARY KEY,
    value INTEGER DEFAULT 0
);

-- Initialize registration counter if not exists
INSERT INTO counters (name, value)
VALUES ('registrations_total', 0)
ON CONFLICT (name) DO NOTHING;

-- Verify tables created
SELECT 'Tables created successfully' AS status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
