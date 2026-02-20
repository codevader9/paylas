import axios from 'axios'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'

const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${env.theSportsDbKey}`

// Free API: key=123, 30 req/min rate limit
// v1 endpoints: eventsnextleague, eventsday, eventspastleague, searchteams, all_leagues

// Popular league IDs per sport
const sportLeagueMap: Record<string, { id: string; name: string }[]> = {
  football: [
    { id: '4328', name: 'English Premier League' },
    { id: '4332', name: 'Italian Serie A' },
    { id: '4335', name: 'Spanish La Liga' },
    { id: '4334', name: 'French Ligue 1' },
    { id: '4331', name: 'German Bundesliga' },
    { id: '4344', name: 'Portuguese Primeira Liga' },
    { id: '4359', name: 'Turkish Super Lig' },
    { id: '4480', name: 'UEFA Champions League' },
    { id: '4481', name: 'UEFA Europa League' },
  ],
  basketball: [
    { id: '4387', name: 'NBA' },
    { id: '4547', name: 'EuroLeague Basketball' },
  ],
  volleyball: [
    { id: '4422', name: 'CEV Champions League Volley' },
  ],
  tennis: [
    { id: '4464', name: 'ATP Tour' },
  ],
}

interface SportsDBEvent {
  idEvent: string
  strEvent: string
  strLeague: string
  idLeague: string
  strThumb?: string
  strHomeTeam: string
  strAwayTeam: string
  strHomeTeamBadge?: string
  strAwayTeamBadge?: string
  strLeagueBadge?: string
  dateEvent: string
  strTime: string
  strVenue?: string
  intHomeScore?: string | null
  intAwayScore?: string | null
  strStatus?: string
  strSport?: string
  strCountry?: string
  strSeason?: string
  strTimestamp?: string
}

function mapStatus(status?: string | null, homeScore?: string | null): string {
  if (!status || status === '' || status === 'Not Started' || status === 'NS') return 'upcoming'
  if (status === 'Match Finished' || status === 'FT' || status === 'AET' || status === 'AP') return 'finished'
  if (status === 'Postponed' || status === 'PST') return 'postponed'
  if (status === 'Cancelled' || status === 'CANC') return 'cancelled'
  // If there's a score but no finished status, it might be live
  if (homeScore && homeScore !== '') return 'live'
  return 'upcoming'
}

function buildMatchDate(event: SportsDBEvent): string {
  // Use strTimestamp if available (most accurate)
  if (event.strTimestamp) return event.strTimestamp

  // Otherwise build from date + time
  if (event.strTime && event.strTime !== '00:00:00' && event.strTime !== '') {
    return `${event.dateEvent}T${event.strTime}+00:00`
  }
  return `${event.dateEvent}T00:00:00+00:00`
}

/**
 * Fetch next upcoming events for leagues of a given sport
 * Uses: eventsnextleague.php?id={leagueId}
 * Free limit: 1 league at a time, returns ~15 events
 */
export async function fetchUpcomingMatches(sport: string, date?: string): Promise<any[]> {
  const leagues = sportLeagueMap[sport] || sportLeagueMap.football
  const allMatches: any[] = []

  for (const league of leagues) {
    try {
      let url: string

      if (date) {
        // eventsday.php - Events on a specific date, filter by league
        // Free limit: 5 results
        url = `${BASE_URL}/eventsday.php?d=${date}&l=${league.id}`
      } else {
        // eventsnextleague.php - Next upcoming events in league
        // Free limit: 1 league, returns ~15 events
        url = `${BASE_URL}/eventsnextleague.php?id=${league.id}`
      }

      console.log(`[TheSportsDB] Fetching: ${league.name} (${league.id})`)
      const { data } = await axios.get(url, { timeout: 15000 })

      const events: SportsDBEvent[] = data.events || []
      if (!events || events.length === 0) {
        console.log(`[TheSportsDB] ${league.name}: Maç bulunamadı`)
        continue
      }

      for (const event of events) {
        const matchDate = buildMatchDate(event)

        const matchData = {
          external_id: event.idEvent,
          sport,
          league_name: event.strLeague || league.name,
          league_logo: event.strLeagueBadge || null,
          home_team: event.strHomeTeam,
          home_logo: event.strHomeTeamBadge || null,
          away_team: event.strAwayTeam,
          away_logo: event.strAwayTeamBadge || null,
          match_date: matchDate,
          venue: event.strVenue || null,
          status: mapStatus(event.strStatus, event.intHomeScore),
          home_score: event.intHomeScore ? parseInt(event.intHomeScore) : null,
          away_score: event.intAwayScore ? parseInt(event.intAwayScore) : null,
          source: 'thesportsdb',
          raw_data: event,
        }

        const { error } = await supabaseAdmin.from('matches').upsert(matchData, {
          onConflict: 'external_id,source',
        })

        if (error) {
          console.error(`[TheSportsDB] Upsert error for ${event.strEvent}:`, error.message)
        } else {
          allMatches.push(matchData)
        }
      }

      console.log(`[TheSportsDB] ${league.name}: ${events.length} maç işlendi`)

      // Premium: 100 req/min
      await new Promise(resolve => setTimeout(resolve, 800))
    } catch (err: any) {
      console.error(`[TheSportsDB] ${league.name} fetch error:`, err.message)
    }
  }

  console.log(`[TheSportsDB] Toplam ${allMatches.length} maç çekildi (${sport})`)
  return allMatches
}

/**
 * Fetch past results for a league
 * Uses: eventspastleague.php?id={leagueId}
 */
export async function fetchPastMatches(sport: string): Promise<any[]> {
  const leagues = sportLeagueMap[sport] || sportLeagueMap.football
  const allMatches: any[] = []

  for (const league of leagues) {
    try {
      const url = `${BASE_URL}/eventspastleague.php?id=${league.id}`
      console.log(`[TheSportsDB] Past events: ${league.name}`)
      const { data } = await axios.get(url, { timeout: 15000 })

      const events: SportsDBEvent[] = data.events || []
      for (const event of events) {
        const matchData = {
          external_id: event.idEvent,
          sport,
          league_name: event.strLeague || league.name,
          league_logo: event.strLeagueBadge || null,
          home_team: event.strHomeTeam,
          home_logo: event.strHomeTeamBadge || null,
          away_team: event.strAwayTeam,
          away_logo: event.strAwayTeamBadge || null,
          match_date: buildMatchDate(event),
          venue: event.strVenue || null,
          status: 'finished',
          home_score: event.intHomeScore ? parseInt(event.intHomeScore) : null,
          away_score: event.intAwayScore ? parseInt(event.intAwayScore) : null,
          source: 'thesportsdb',
          raw_data: event,
        }

        const { error } = await supabaseAdmin.from('matches').upsert(matchData, {
          onConflict: 'external_id,source',
        })
        if (!error) allMatches.push(matchData)
      }

      await new Promise(resolve => setTimeout(resolve, 800))
    } catch (err: any) {
      console.error(`[TheSportsDB] Past ${league.name} error:`, err.message)
    }
  }

  return allMatches
}

/**
 * Search for a team by name
 * Uses: searchteams.php?t={teamName}
 */
export async function searchTeam(teamName: string) {
  const url = `${BASE_URL}/searchteams.php?t=${encodeURIComponent(teamName)}`
  const { data } = await axios.get(url, { timeout: 10000 })
  return data.teams || []
}

/**
 * Get all available leagues
 * Uses: all_leagues.php
 */
export async function getAllLeagues() {
  const url = `${BASE_URL}/all_leagues.php`
  const { data } = await axios.get(url, { timeout: 10000 })
  return data.leagues || []
}

/**
 * Get all available sports
 * Uses: all_sports.php
 */
export async function getAllSports() {
  const url = `${BASE_URL}/all_sports.php`
  const { data } = await axios.get(url, { timeout: 10000 })
  return data.sports || []
}

/**
 * Get supported leagues map (for frontend display)
 */
export function getSupportedLeagues() {
  return sportLeagueMap
}
