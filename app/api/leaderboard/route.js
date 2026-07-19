import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Trade = require('@/lib/models/Trade')
const User = require('@/lib/models/User')
const { getUserFromRequest } = require('@/lib/serverAuth')

export const dynamic = 'force-dynamic'

// "Leader Board of the Day": real users ranked by today's closed-trade profit,
// padded with synthetic traders so the board looks alive on a fresh DB.
// The response also includes the requesting user's own profit and position.
const FAKE = [
  'KING +917829856954', 'Mentor Rohit', 'Patty Mesquita', 'Hritik dhiman', '# Sakibul',
  'Elisa Camargo', 'Ali R.', 'Maria S.', 'Chen W.', 'Fatima K.', 'Diego M.',
  'Olga P.', 'Yusuf A.', 'Sofia L.', 'Liam O.', 'Aisha N.', 'Marco T.', 'Hana B.',
]
// ISO-3166 alpha-2 codes (lowercase) so the client can render real flag IMAGES
// (flagcdn) instead of emoji — emoji degrade to plain "PK"/"ZA" text on Windows
// and many Android WebViews/TWA shells where flag glyphs aren't installed.
const FLAG_CC = ['pk', 'in', 'br', 'bd', 'ng', 'id', 'eg', 'tr', 'vn', 'mx', 'za', 'ph', 'co', 'ar', 'th', 'my', 'sa', 'gb']
const COUNTRY_CC = {
  Pakistan: 'pk', India: 'in', Bangladesh: 'bd', 'United Arab Emirates': 'ae',
  'Saudi Arabia': 'sa', 'United Kingdom': 'gb', Germany: 'de', France: 'fr',
  Spain: 'es', Italy: 'it', Turkey: 'tr', Egypt: 'eg', Nigeria: 'ng',
  'South Africa': 'za', Brazil: 'br', Mexico: 'mx', Indonesia: 'id',
  Malaysia: 'my', Philippines: 'ph', Vietnam: 'vn', Thailand: 'th',
  Japan: 'jp', 'South Korea': 'kr', Australia: 'au',
}

function dailySeed() {
  const d = new Date()
  return d.getUTCFullYear() * 1000 + (d.getUTCMonth() + 1) * 40 + d.getUTCDate()
}
function pseudo(n) {
  const x = Math.sin(n) * 10000
  return x - Math.floor(x)
}
const shortUid = (objectId) => String(parseInt(objectId.toString().slice(0, 8), 16)).slice(0, 8)

export async function GET(request) {
  const board = []
  let myUid = null
  let myProfit = 0

  try {
    await connectDB()

    // real users: profit from trades closed since the start of today (UTC)
    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    const agg = await Trade.aggregate([
      { $match: { closeTime: { $gte: since }, status: { $in: ['won', 'lost'] } } },
      {
        $group: {
          _id: '$userId',
          profit: { $sum: '$profit' },
          trades: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
        },
      },
      { $sort: { profit: -1 } },
      { $limit: 30 },
    ])
    const userIds = agg.map((a) => a._id)
    const users = await User.find({ _id: { $in: userIds } }).lean()
    const map = Object.fromEntries(users.map((u) => [u._id.toString(), u]))
    for (const a of agg) {
      const u = map[a._id.toString()]
      if (!u) continue
      const name = u.email.split('@')[0]
      board.push({
        name: name.length > 2 ? name[0] + '***' + name.slice(-1) : name,
        uid: shortUid(u._id),
        cc: COUNTRY_CC[u.country] || null,
        anon: false,
        profit: Math.round(a.profit * 100) / 100,
        trades: a.trades,
        winRate: a.trades ? Math.round((a.wins / a.trades) * 100) : 0,
        real: true,
      })
    }

    // requesting user's own daily profit (even if they aren't in the top 30)
    try {
      const me = await getUserFromRequest(request)
      if (me) {
        myUid = shortUid(me._id)
        const mine = agg.find((a) => a._id.toString() === me._id.toString())
        if (mine) {
          myProfit = Math.round(mine.profit * 100) / 100
        } else {
          const own = await Trade.aggregate([
            {
              $match: {
                userId: me._id,
                closeTime: { $gte: since },
                status: { $in: ['won', 'lost'] },
              },
            },
            { $group: { _id: null, profit: { $sum: '$profit' } } },
          ])
          myProfit = own.length ? Math.round(own[0].profit * 100) / 100 : 0
        }
      }
    } catch {
      /* anonymous request — no personal row */
    }
  } catch {
    /* DB down — board stays synthetic */
  }

  // synthetic padding (stable per-day values)
  const seed = dailySeed()
  FAKE.forEach((name, i) => {
    const r = pseudo(seed + i * 7.13)
    board.push({
      name,
      uid: String(10000000 + Math.floor(pseudo(seed + i * 9.41) * 89999999)),
      cc: FLAG_CC[Math.floor(pseudo(seed + i * 3.33) * FLAG_CC.length)],
      anon: pseudo(seed + i * 6.17) > 0.7, // some entries show as #ID like the real board
      profit: Math.round((500 + r * 24500) * 100) / 100,
      trades: Math.round(20 + pseudo(seed + i) * 380),
      winRate: Math.round(52 + pseudo(seed + i * 2.7) * 33),
      real: false,
    })
  })

  // pinned #1 like the real board ("AC_Trader  $30,000.00+")
  board.push({
    name: 'AC_Trader',
    uid: '30000001',
    cc: 'ae',
    anon: false,
    profit: 30000,
    plus: true,
    trades: 412,
    winRate: 84,
    real: false,
  })

  board.sort((a, b) => b.profit - a.profit)
  const traders = board.slice(0, 15)

  const myIndex = myUid ? traders.findIndex((t) => t.uid === myUid) : -1
  return NextResponse.json({
    traders,
    me: myUid ? { uid: myUid, profit: myProfit, position: myIndex >= 0 ? myIndex + 1 : null } : null,
  })
}
