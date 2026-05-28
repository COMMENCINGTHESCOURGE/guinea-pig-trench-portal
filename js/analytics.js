// Guinea Pig Trench — Music + Game Analytics
// Tracks play counts, listen time, skip rates, game time
// Stores in localStorage (or Supabase if logged in)

class Analytics {
  constructor() {
    this.data = this._load()
    this._saveInterval = setInterval(() => this._save(), 30000) // auto-save every 30s
  }

  _load() {
    try {
      const saved = localStorage.getItem('gpt_analytics')
      return saved ? JSON.parse(saved) : this._defaults()
    } catch (e) {
      return this._defaults()
    }
  }

  _defaults() {
    return {
      music: {},      // trackFile -> {plays, totalListenMs, skips, lastPlayed, avgListenPct}
      games: {},      // gameId -> {launches, totalPlayMs, lastPlayed}
      session: {
        startedAt: Date.now(),
        totalTimeMs: 0,
      },
    }
  }

  _save() {
    this.data.session.totalTimeMs = Date.now() - this.data.session.startedAt
    try {
      localStorage.setItem('gpt_analytics', JSON.stringify(this.data))
    } catch (e) {}

    // Also save to Supabase if logged in
    if (typeof auth !== 'undefined' && auth.isLoggedIn && auth.supabase) {
      auth.supabase.from('analytics').upsert({
        user_id: auth.user.id,
        data: this.data,
        updated_at: new Date().toISOString(),
      }).catch(() => {})
    }
  }

  // ─── MUSIC ANALYTICS ───────────────────────────

  trackPlay(trackFile) {
    if (!this.data.music[trackFile]) {
      this.data.music[trackFile] = {
        plays: 0,
        totalListenMs: 0,
        skips: 0,
        lastPlayed: null,
        listenSamples: [],
      }
    }
    this.data.music[trackFile].plays++
    this.data.music[trackFile].lastPlayed = Date.now()
    this.data.music[trackFile]._startedAt = Date.now()
  }

  trackSkip(trackFile) {
    if (!this.data.music[trackFile]) return
    const m = this.data.music[trackFile]
    m.skips++

    // Calculate how much they listened before skipping
    if (m._startedAt) {
      const listenMs = Date.now() - m._startedAt
      m.totalListenMs += listenMs
      m.listenSamples.push(listenMs)
      if (m.listenSamples.length > 20) m.listenSamples.shift()
      delete m._startedAt
    }
  }

  trackEnd(trackFile) {
    if (!this.data.music[trackFile]) return
    const m = this.data.music[trackFile]
    if (m._startedAt) {
      const listenMs = Date.now() - m._startedAt
      m.totalListenMs += listenMs
      m.listenSamples.push(listenMs)
      if (m.listenSamples.length > 20) m.listenSamples.shift()
      delete m._startedAt
    }
  }

  // ─── GAME ANALYTICS ───────────────────────────

  gameLaunch(gameId) {
    if (!this.data.games[gameId]) {
      this.data.games[gameId] = {
        launches: 0,
        totalPlayMs: 0,
        lastPlayed: null,
      }
    }
    this.data.games[gameId].launches++
    this.data.games[gameId].lastPlayed = Date.now()
    this.data.games[gameId]._startedAt = Date.now()
  }

  gameExit(gameId) {
    if (!this.data.games[gameId]) return
    const g = this.data.games[gameId]
    if (g._startedAt) {
      g.totalPlayMs += Date.now() - g._startedAt
      delete g._startedAt
    }
  }

  // ─── REPORTS ───────────────────────────────────

  getMusicReport() {
    const tracks = Object.entries(this.data.music).map(([file, m]) => {
      const avgListenMs = m.listenSamples.length > 0
        ? m.listenSamples.reduce((a, b) => a + b, 0) / m.listenSamples.length
        : 0
      const skipRate = m.plays > 0 ? (m.skips / m.plays * 100) : 0
      const totalMinutes = (m.totalListenMs / 60000).toFixed(1)

      return {
        file,
        plays: m.plays,
        skips: m.skips,
        skipRate: Math.round(skipRate),
        totalMinutes: parseFloat(totalMinutes),
        avgListenSec: Math.round(avgListenMs / 1000),
        lastPlayed: m.lastPlayed,
        score: m.plays * 10 - m.skips * 15 + parseFloat(totalMinutes) * 2, // quality score
      }
    })

    tracks.sort((a, b) => b.score - a.score)
    return tracks
  }

  getGameReport() {
    return Object.entries(this.data.games).map(([id, g]) => ({
      id,
      launches: g.launches,
      totalMinutes: (g.totalPlayMs / 60000).toFixed(1),
      lastPlayed: g.lastPlayed,
    })).sort((a, b) => b.launches - a.launches)
  }

  // Get tracks that should be eliminated (high skip rate, low plays)
  getWeakTracks() {
    const report = this.getMusicReport()
    return report.filter(t => t.skipRate > 60 || (t.plays > 3 && t.avgListenSec < 30))
  }

  getStrongTracks() {
    const report = this.getMusicReport()
    return report.filter(t => t.skipRate < 20 && t.plays > 2)
  }

  // Console-friendly summary
  printReport() {
    console.log('\n=== MUSIC ANALYTICS ===')
    const music = this.getMusicReport()
    if (music.length === 0) {
      console.log('  No data yet — play some tracks!')
    } else {
      console.table(music.map(t => ({
        Track: t.file.slice(0, 40),
        Plays: t.plays,
        Skips: t.skips,
        'Skip%': t.skipRate + '%',
        'Total Min': t.totalMinutes,
        'Avg Listen': t.avgListenSec + 's',
        Score: Math.round(t.score),
      })))
    }

    console.log('\n=== GAME ANALYTICS ===')
    const games = this.getGameReport()
    if (games.length === 0) {
      console.log('  No data yet — play some games!')
    } else {
      console.table(games.map(g => ({
        Game: g.id,
        Launches: g.launches,
        'Total Min': g.totalMinutes,
      })))
    }

    const weak = this.getWeakTracks()
    if (weak.length > 0) {
      console.log('\n=== WEAK TRACKS (candidates for elimination) ===')
      weak.forEach(t => console.log(`  ${t.file.slice(0, 40)} — ${t.skipRate}% skip rate, ${t.avgListenSec}s avg listen`))
    }
  }
}

const analytics = new Analytics()

// Expose report to console
window.gptAnalytics = () => analytics.printReport()
console.log('Analytics loaded — type gptAnalytics() in console for report')
