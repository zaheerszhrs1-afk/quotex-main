// Seeds the database with an admin user, a test user, all assets, and default
// payment settings.
//
// Note: candle history is generated in memory by server/priceEngine.js on boot
// (a long per-asset, per-timeframe history), so it isn't stored in the DB.
// Load .env.local (local dev) then .env (Dokploy/production) as a fallback; injected
// process.env vars always take precedence since dotenv won't override existing values.
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const connectDB = require('../lib/db')
const mongoose = require('mongoose')
const User = require('../lib/models/User')
const Asset = require('../lib/models/Asset')
const Tournament = require('../lib/models/Tournament')
const { hashPassword } = require('../lib/auth')
const { getSettings, syncMethods } = require('../lib/getSettings')
const { ASSETS } = require('../lib/assetsConfig')

// Demo tournaments. Times are computed relative to "now" on each seed so the
// statuses (active / upcoming) always look sensible.
function seedTournaments() {
  const now = Date.now()
  const H = 3600 * 1000
  const D = 24 * H
  return [
    {
      name: 'Free Friday',
      description: 'A free daily tournament — grow your tournament balance the most to win a share of the prize pool.',
      prizePool: 1000, entryFee: 0, rebuyCost: 1, rebuys: 100, startBalance: 10000,
      startTime: new Date(now - 12 * H), endTime: new Date(now + 12 * H),
      prizes: [400, 250, 200, 100, 50],
    },
    {
      name: 'Weekend Battle',
      description: 'A two-day paid tournament with a bigger prize pool.',
      prizePool: 5000, entryFee: 1, rebuyCost: 1, rebuys: 50, startBalance: 10000,
      startTime: new Date(now + 7 * H), endTime: new Date(now + 7 * H + 2 * D),
      prizes: [2000, 1200, 800, 500, 300, 200],
    },
    {
      name: 'Daily Sprint',
      description: 'A fast daily sprint — climb the leaderboard before the clock runs out.',
      prizePool: 500, entryFee: 0, rebuyCost: 1, rebuys: 100, startBalance: 5000,
      startTime: new Date(now + 4 * D), endTime: new Date(now + 5 * D),
      prizes: [200, 150, 100, 50],
    },
    {
      name: 'Pro League',
      description: 'A premium weekly tournament for serious traders.',
      prizePool: 10000, entryFee: 10, rebuyCost: 5, rebuys: 20, startBalance: 25000,
      startTime: new Date(now + 6 * D), endTime: new Date(now + 13 * D),
      prizes: [4000, 2500, 1500, 1000, 600, 400],
    },
  ]
}

async function upsertUser(email, password, role, extra = {}) {
  const passwordHash = await hashPassword(password)
  const existing = await User.findOne({ email })
  if (existing) {
    existing.passwordHash = passwordHash
    existing.role = role
    Object.assign(existing, extra)
    await existing.save()
    console.log(`  updated user ${email}`)
  } else {
    await User.create({ email, passwordHash, role, ...extra })
    console.log(`  created user ${email}`)
  }
}

async function main() {
  await connectDB()
  console.log('Seeding…')

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@test.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!'

  await upsertUser(adminEmail, adminPassword, 'admin', { demoBalance: 10000, realBalance: 100000 })
  await upsertUser('user@test.com', 'User123!', 'user', { demoBalance: 10000, realBalance: 0 })

  // assets
  for (const a of ASSETS) {
    await Asset.updateOne(
      { symbol: a.symbol },
      {
        $set: {
          symbol: a.symbol,
          name: a.name,
          category: a.category,
          payout: a.payout,
          basePrice: a.basePrice,
          isActive: true,
        },
      },
      { upsert: true }
    )
  }
  console.log(`  seeded ${ASSETS.length} assets`)

  // tournaments — upsert by name so re-seeding refreshes the demo times
  const tournaments = seedTournaments()
  for (const t of tournaments) {
    await Tournament.updateOne({ name: t.name }, { $set: { ...t, isActive: true } }, { upsert: true })
  }
  console.log(`  seeded ${tournaments.length} tournaments`)

  // payment settings — refresh the method list (E-Pay / Banks / Crypto) while
  // keeping any numbers/wallets the admin already configured
  await getSettings()
  const s = await syncMethods()
  console.log(`  payment settings ready (${s.methods.length} methods)`)

  console.log('\nDone. Credentials:')
  console.log(`  Admin: ${adminEmail} / ${adminPassword}`)
  console.log('  User:  user@test.com / User123!')

  await mongoose.connection.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('Seed failed:', e.message)
  console.error('Is MongoDB running? Use "npm run memdb" (separate terminal) or install MongoDB.')
  process.exit(1)
})
