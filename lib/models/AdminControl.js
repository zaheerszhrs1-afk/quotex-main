const mongoose = require('mongoose')

// Singleton document that persists the admin's trade-control settings so they
// survive a server restart / admin logout. Written only on admin actions (rare),
// never in the per-tick hot loop.
const AdminControlSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'main', unique: true },
    autoAll: { type: Boolean, default: false }, // master auto-profit switch
    strict: { type: Boolean, default: false }, // legacy boolean: false = Smart, true = Max
    mode: { type: String, default: 'smart', enum: ['smart', 'balanced', 'strict'] }, // 'smart' | 'balanced' | 'strict'
    countDemo: { type: Boolean, default: true }, // include demo trades in algorithm
    autoAssets: { type: [String], default: [] }, // per-asset auto-profit on
    userForce: { type: Map, of: String, default: {} }, // userId -> 'win' | 'loss'
    liveAssets: { type: [String], default: [] }, // symbols on the real Binance feed (admin control off for these only)
    tradingView: { type: Boolean, default: false }, // show real TradingView charts on the user side (all assets)
  },
  { timestamps: true }
)

module.exports = mongoose.models.AdminControl || mongoose.model('AdminControl', AdminControlSchema)
