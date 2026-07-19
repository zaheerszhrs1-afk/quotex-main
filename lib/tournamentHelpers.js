// Shared helpers for the tournaments feature: serialization, a deterministic
// synthetic-participant generator (so a fresh tournament still looks alive,
// like the leaderboard route does), and leaderboard assembly with prizes.
const { tournamentStatus } = require('./models/Tournament')

const FAKE_NAMES = [
  'Mamun Jamalpuri', 'Ahmed shah kashmiri', 'Rct', 'Idris pro10', 'Sarfaraz Khan',
  'Elisa Camargo', 'Diego M.', 'Hritik dhiman', 'Patty Mesquita', 'Mentor Rohit',
  'Olga P.', 'Yusuf A.', 'Sofia L.', 'Liam O.', 'Aisha N.', 'Marco T.', 'Hana B.',
  'Chen W.', 'Fatima K.', 'Ali R.', 'Maria S.', 'Karim B.', 'Nadia H.', 'Omar F.',
]
const FLAG_CC = ['pk', 'in', 'br', 'bd', 'ng', 'id', 'eg', 'tr', 'vn', 'mx', 'za', 'ph', 'co', 'ae', 'th', 'my', 'sa', 'gb']

const COUNTRY_CC = {
  Pakistan: 'pk', India: 'in', Bangladesh: 'bd', 'United Arab Emirates': 'ae',
  'Saudi Arabia': 'sa', 'United Kingdom': 'gb', Germany: 'de', France: 'fr',
  Spain: 'es', Italy: 'it', Turkey: 'tr', Egypt: 'eg', Nigeria: 'ng',
  'South Africa': 'za', Brazil: 'br', Mexico: 'mx', Indonesia: 'id',
  Malaysia: 'my', Philippines: 'ph', Vietnam: 'vn', Thailand: 'th',
  Japan: 'jp', 'South Korea': 'kr', Australia: 'au', Canada: 'ca',
}

function seedFromId(id) {
  const s = String(id)
  let n = 0
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 1e9
  return n
}
function pseudo(n) {
  const x = Math.sin(n) * 10000
  return x - Math.floor(x)
}
const shortUid = (objectId) => String(parseInt(String(objectId).slice(0, 8), 16)).slice(0, 8)

// Deterministic synthetic participants for a tournament, ordered by balance desc.
function syntheticParticipants(tournamentId, count, startBalance) {
  const seed = seedFromId(tournamentId)
  const out = []
  for (let i = 0; i < count; i++) {
    const r = pseudo(seed + i * 7.13)
    const anon = pseudo(seed + i * 6.17) > 0.6
    // top entries grow their balance many-fold; tail hovers near start
    const mult = 1 + r * r * 28
    out.push({
      name: anon ? `#${10000000 + Math.floor(pseudo(seed + i * 9.41) * 89999999)}` : FAKE_NAMES[i % FAKE_NAMES.length],
      cc: FLAG_CC[Math.floor(pseudo(seed + i * 3.33) * FLAG_CC.length)],
      balance: Math.round(Math.max(startBalance * 0.4, startBalance * mult) * 100) / 100,
      real: false,
    })
  }
  return out
}

function serializeTournament(t, extra = {}) {
  return {
    id: t._id.toString(),
    name: t.name,
    description: t.description || '',
    prizePool: t.prizePool,
    entryFee: t.entryFee,
    rebuyCost: t.rebuyCost,
    rebuys: t.rebuys,
    startBalance: t.startBalance,
    startTime: t.startTime,
    endTime: t.endTime,
    prizes: t.prizes || [],
    isActive: t.isActive,
    status: tournamentStatus(t),
    ...extra,
  }
}

// Build the ranked leaderboard: real entries + synthetic padding, sorted by
// balance, with prizes assigned by final rank from `tournament.prizes`.
function buildLeaderboard(tournament, realEntries, userMap, myUserId) {
  const rows = []
  for (const e of realEntries) {
    const u = userMap[e.userId.toString()]
    const name = u ? (u.email ? u.email.split('@')[0] : `#${shortUid(e.userId)}`) : `#${shortUid(e.userId)}`
    rows.push({
      name: name.length > 2 ? name[0] + '***' + name.slice(-1) : name,
      cc: (u && COUNTRY_CC[u.country]) || 'pk',
      balance: Math.round(e.balance * 100) / 100,
      real: true,
      isMe: myUserId && e.userId.toString() === myUserId.toString(),
    })
  }
  const padTo = Math.max(20, rows.length + 12)
  rows.push(...syntheticParticipants(tournament._id, padTo - rows.length, tournament.startBalance))
  rows.sort((a, b) => b.balance - a.balance)

  const prizes = tournament.prizes || []
  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    cc: r.cc,
    balance: r.balance,
    prize: prizes[i] || 0,
    real: r.real,
    isMe: !!r.isMe,
  }))
}

module.exports = { serializeTournament, syntheticParticipants, buildLeaderboard, shortUid }
