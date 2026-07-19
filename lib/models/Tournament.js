const mongoose = require('mongoose')

const TournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    prizePool: { type: Number, default: 1000 },
    entryFee: { type: Number, default: 0 }, // 0 = free tournament
    rebuyCost: { type: Number, default: 1 },
    rebuys: { type: Number, default: 100 }, // number of rebuys allowed
    startBalance: { type: Number, default: 10000 }, // starting tournament balance
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    // prize distribution for the top ranks, e.g. [400, 250, 200, 100, 50]
    prizes: { type: [Number], default: [] },
    isActive: { type: Boolean, default: true }, // admin can hide without deleting
  },
  { timestamps: true }
)

// Derived lifecycle status from the clock.
function tournamentStatus(t, now = Date.now()) {
  const start = new Date(t.startTime).getTime()
  const end = new Date(t.endTime).getTime()
  if (now < start) return 'upcoming'
  if (now > end) return 'completed'
  return 'active'
}

module.exports = mongoose.models.Tournament || mongoose.model('Tournament', TournamentSchema)
module.exports.tournamentStatus = tournamentStatus
