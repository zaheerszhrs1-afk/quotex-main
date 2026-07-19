const mongoose = require('mongoose')

const AssetSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, default: 'Currencies' }, // Currencies | Crypto | Commodities
    payout: { type: Number, default: 80 },
    isActive: { type: Boolean, default: true },
    basePrice: { type: Number, required: true },
  },
  { timestamps: true }
)

module.exports = mongoose.models.Asset || mongoose.model('Asset', AssetSchema)
