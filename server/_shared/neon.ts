/**
 * Neon PostgreSQL adapter
 * Replaces Convex for persistent data storage
 *
 * Uses Neon's serverless driver for edge-compatible connections
 */

const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;
const QUERY_TIMEOUT_MS = 5000;

interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

/**
 * Execute a SQL query against Neon PostgreSQL
 * Uses the Neon serverless HTTP API for edge compatibility
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  if (!NEON_DATABASE_URL) {
    throw new Error('NEON_DATABASE_URL not configured');
  }

  // Parse connection string to extract host
  const url = new URL(NEON_DATABASE_URL);
  const host = url.hostname;
  const user = url.username;
  const password = url.password;
  const database = url.pathname.slice(1);

  // Use Neon's serverless HTTP API
  const apiUrl = `https://${host}/sql`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': NEON_DATABASE_URL,
      },
      body: JSON.stringify({
        query: sql,
        params: params,
      }),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Neon query failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    return {
      rows: (result.rows || []) as T[],
      rowCount: result.rowCount || result.rows?.length || 0,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('Neon query timeout');
    }
    throw err;
  }
}

/**
 * Generate a unique referral code from email
 */
function generateReferralCode(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash + email.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).padStart(6, '0').slice(0, 8);
}

export interface RegistrationResult {
  status: 'registered' | 'already_registered';
  referralCode: string;
  referralCount: number;
  position?: number;
}

/**
 * Register a new user or return existing registration
 */
export async function registerUser(
  email: string,
  source: string,
  appVersion: string,
  referredBy?: string
): Promise<RegistrationResult> {
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists
  const existing = await query<{ referral_code: string; referral_count: number }>(
    'SELECT referral_code, referral_count FROM registrations WHERE normalized_email = $1',
    [normalizedEmail]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0]!;
    return {
      status: 'already_registered',
      referralCode: row.referral_code || '',
      referralCount: row.referral_count || 0,
    };
  }

  // Generate unique referral code
  let referralCode = generateReferralCode(normalizedEmail);

  // Check for collision and regenerate if needed
  for (let attempt = 0; attempt < 5; attempt++) {
    const collision = await query(
      'SELECT 1 FROM registrations WHERE referral_code = $1',
      [referralCode]
    );
    if (collision.rows.length === 0) break;
    referralCode = generateReferralCode(`${normalizedEmail}:${attempt + 1}`);
  }

  // Credit referrer if applicable
  if (referredBy) {
    await query(
      'UPDATE registrations SET referral_count = referral_count + 1 WHERE referral_code = $1',
      [referredBy]
    );
  }

  // Get and increment position counter
  await query(
    `INSERT INTO counters (name, value) VALUES ('registrations_total', 1)
     ON CONFLICT (name) DO UPDATE SET value = counters.value + 1`,
    []
  );

  const positionResult = await query<{ value: number }>(
    'SELECT value FROM counters WHERE name = $1',
    ['registrations_total']
  );
  const position = positionResult.rows[0]?.value || 0;

  // Insert new registration
  await query(
    `INSERT INTO registrations
     (email, normalized_email, source, app_version, referral_code, referred_by, referral_count)
     VALUES ($1, $2, $3, $4, $5, $6, 0)`,
    [email.trim(), normalizedEmail, source, appVersion, referralCode, referredBy || null]
  );

  return {
    status: 'registered',
    referralCode,
    referralCount: 0,
    position,
  };
}

/**
 * Get referral position and stats
 */
export async function getPosition(referralCode: string): Promise<{
  referralCount: number;
  total: number;
} | null> {
  const reg = await query<{ referral_count: number }>(
    'SELECT referral_count FROM registrations WHERE referral_code = $1',
    [referralCode]
  );

  if (reg.rows.length === 0) return null;

  const total = await query<{ value: number }>(
    'SELECT value FROM counters WHERE name = $1',
    ['registrations_total']
  );

  return {
    referralCount: reg.rows[0]!.referral_count || 0,
    total: total.rows[0]?.value || 0,
  };
}
