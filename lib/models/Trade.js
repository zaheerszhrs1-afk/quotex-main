const mongoose = require('mongoose')

const TradeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    symbol: { type: String, required: true },
    direction: { type: String, enum: ['up', 'down'], required: true },
    amount: { type: Number, required: true },
    duration: { type: Number, required: true }, // seconds
    payout: { type: Number, required: true }, // percent
    openPrice: { type: Number, required: true },
    closePrice: { type: Number, default: null },
    openTime: { type: Date, required: true },
    closeTime: { type: Date, required: true },
    status: { type: String, enum: ['open', 'won', 'lost'], default: 'open', index: true },
    profit: { type: Number, default: 0 },
    accountType: { type: String, enum: ['demo', 'real'], default: 'demo' },
  },
  { timestamps: true }
)

module.exports = mongoose.models.Trade || mongoose.model('Trade', TradeSchema)
