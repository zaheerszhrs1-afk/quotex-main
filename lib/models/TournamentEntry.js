const mongoose = require('mongoose')

// One row per (tournament, user) participation. Created on join; `balance`
// is the participant's running tournament balance shown on the leaderboard.
const TournamentEntrySchema = new mongoose.Schema(
  {
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    balance: { type: Number, default: 0 },
    rebuysUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
)

TournamentEntrySchema.index({ tournamentId: 1, userId: 1 }, { unique: true })

module.exports =
  mongoose.models.TournamentEntry || mongoose.model('TournamentEntry', TournamentEntrySchema)
