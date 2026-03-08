/**
 * Election Calendar Service
 *
 * Provides global election calendar with proximity-based risk scoring.
 * Elections closer in time and with higher instability impact get higher risk scores.
 *
 * Data source: curated list of upcoming elections in key countries.
 */

export interface Election {
  country: string;
  iso3: string;
  electionType: 'presidential' | 'parliamentary' | 'legislative' | 'local' | 'referendum' | 'general';
  date: string;
  description: string;
  daysUntil: number;
  status: 'past' | 'upcoming' | 'imminent';
  instabilityImpact: 'high' | 'medium' | 'low';
  riskScore: number;
}

export interface ElectionCalendarData {
  elections: Election[];
  count: number;
  upcomingCount: number;
  imminentCount: number;
  highestRisk: Election | null;
  timestamp: string;
}

// Curated list of major global elections
// Updated periodically - these are elections through 2027
const UPCOMING_ELECTIONS: {
  country: string;
  iso3: string;
  electionType: Election['electionType'];
  date: string;
  description: string;
  instabilityImpact: Election['instabilityImpact'];
}[] = [
  // 2026
  { country: 'Philippines', iso3: 'PHL', electionType: 'general', date: '2026-05-11', description: 'Midterm elections for Senate and House', instabilityImpact: 'medium' },
  { country: 'Colombia', iso3: 'COL', electionType: 'legislative', date: '2026-03-08', description: 'Congressional elections', instabilityImpact: 'medium' },
  { country: 'Mexico', iso3: 'MEX', electionType: 'legislative', date: '2026-06-07', description: 'Midterm elections', instabilityImpact: 'medium' },
  { country: 'Australia', iso3: 'AUS', electionType: 'parliamentary', date: '2026-05-17', description: 'Federal election', instabilityImpact: 'low' },
  { country: 'Czech Republic', iso3: 'CZE', electionType: 'parliamentary', date: '2026-10-10', description: 'Parliamentary elections', instabilityImpact: 'low' },
  { country: 'Norway', iso3: 'NOR', electionType: 'parliamentary', date: '2026-09-13', description: 'Parliamentary elections', instabilityImpact: 'low' },
  { country: 'Brazil', iso3: 'BRA', electionType: 'general', date: '2026-10-04', description: 'Presidential and legislative elections', instabilityImpact: 'high' },
  { country: 'South Korea', iso3: 'KOR', electionType: 'presidential', date: '2026-06-03', description: 'Snap presidential election', instabilityImpact: 'high' },

  // 2027
  { country: 'France', iso3: 'FRA', electionType: 'presidential', date: '2027-04-10', description: 'Presidential election (1st round)', instabilityImpact: 'high' },
  { country: 'Germany', iso3: 'DEU', electionType: 'parliamentary', date: '2027-09-26', description: 'Federal election', instabilityImpact: 'high' },
  { country: 'India', iso3: 'IND', electionType: 'general', date: '2027-05-01', description: 'General elections', instabilityImpact: 'high' },
  { country: 'South Africa', iso3: 'ZAF', electionType: 'general', date: '2027-05-29', description: 'National and provincial elections', instabilityImpact: 'high' },
  { country: 'Nigeria', iso3: 'NGA', electionType: 'general', date: '2027-02-25', description: 'Presidential and National Assembly', instabilityImpact: 'high' },
  { country: 'Iran', iso3: 'IRN', electionType: 'presidential', date: '2027-06-18', description: 'Presidential election', instabilityImpact: 'high' },
  { country: 'Turkey', iso3: 'TUR', electionType: 'presidential', date: '2027-06-13', description: 'Presidential and parliamentary elections', instabilityImpact: 'high' },
  { country: 'Kenya', iso3: 'KEN', electionType: 'general', date: '2027-08-09', description: 'General elections', instabilityImpact: 'high' },
  { country: 'United Kingdom', iso3: 'GBR', electionType: 'parliamentary', date: '2027-01-01', description: 'Next general election (by Jan 2030)', instabilityImpact: 'medium' },

  // High-concern regions - ongoing or recent
  { country: 'Venezuela', iso3: 'VEN', electionType: 'presidential', date: '2026-12-01', description: 'Presidential election (tentative)', instabilityImpact: 'high' },
  { country: 'Myanmar', iso3: 'MMR', electionType: 'general', date: '2026-08-01', description: 'Elections promised by military junta', instabilityImpact: 'high' },
  { country: 'Pakistan', iso3: 'PAK', electionType: 'general', date: '2027-02-08', description: 'Next general elections', instabilityImpact: 'high' },
];

/**
 * Calculate proximity score based on days until election
 */
function getProximityScore(daysUntil: number): number {
  const absDays = Math.abs(daysUntil);
  if (absDays <= 30) return 100;
  if (absDays <= 90) return 70;
  if (absDays <= 180) return 40;
  if (absDays <= 365) return 20;
  return 5;
}

/**
 * Impact multiplier for instability
 */
function getImpactMultiplier(impact: Election['instabilityImpact']): number {
  switch (impact) {
    case 'high': return 1.5;
    case 'medium': return 1.0;
    case 'low': return 0.6;
  }
}

/**
 * Calculate risk score for an election
 */
function calculateRiskScore(daysUntil: number, impact: Election['instabilityImpact']): number {
  const proximityScore = getProximityScore(daysUntil);
  const multiplier = getImpactMultiplier(impact);
  return Math.round(proximityScore * multiplier * 10) / 10;
}

/**
 * Determine election status
 */
function getStatus(daysUntil: number): Election['status'] {
  if (daysUntil < 0) return 'past';
  if (daysUntil <= 30) return 'imminent';
  return 'upcoming';
}

/**
 * Fetch election calendar data
 */
export function fetchElectionCalendar(countryFilter?: string): ElectionCalendarData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const countryLower = countryFilter?.toLowerCase().trim() ?? '';

  const elections: Election[] = UPCOMING_ELECTIONS
    .filter(entry => {
      if (!countryLower) return true;
      return (
        entry.country.toLowerCase().includes(countryLower) ||
        entry.iso3.toLowerCase() === countryLower
      );
    })
    .map(entry => {
      const electionDate = new Date(entry.date);
      electionDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((electionDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      const status = getStatus(daysUntil);
      const riskScore = calculateRiskScore(daysUntil, entry.instabilityImpact);

      return {
        country: entry.country,
        iso3: entry.iso3,
        electionType: entry.electionType,
        date: entry.date,
        description: entry.description,
        daysUntil,
        status,
        instabilityImpact: entry.instabilityImpact,
        riskScore,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const upcomingElections = elections.filter(e => e.status === 'upcoming' || e.status === 'imminent');
  const imminentElections = elections.filter(e => e.status === 'imminent');

  return {
    elections,
    count: elections.length,
    upcomingCount: upcomingElections.length,
    imminentCount: imminentElections.length,
    highestRisk: elections[0] || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get risk level color
 */
export function getRiskColor(riskScore: number): string {
  if (riskScore >= 100) return '#ff0000';
  if (riskScore >= 70) return '#ff4500';
  if (riskScore >= 40) return '#ffa500';
  if (riskScore >= 20) return '#ffd700';
  return '#4caf50';
}

/**
 * Get election type icon
 */
export function getElectionIcon(type: Election['electionType']): string {
  switch (type) {
    case 'presidential': return '\u{1F3DB}\u{FE0F}'; // 🏛️
    case 'parliamentary': return '\u{1F4DC}'; // 📜
    case 'legislative': return '\u{2696}\u{FE0F}'; // ⚖️
    case 'general': return '\u{1F5F3}\u{FE0F}'; // 🗳️
    case 'referendum': return '\u{2753}'; // ❓
    case 'local': return '\u{1F3D8}\u{FE0F}'; // 🏘️
    default: return '\u{1F5F3}\u{FE0F}'; // 🗳️
  }
}

/**
 * Format days until election
 */
export function formatDaysUntil(days: number): string {
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `${days} days`;
  if (days <= 30) return `${Math.round(days / 7)} weeks`;
  if (days <= 365) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 365)} years`;
}
