const mongoose = require('mongoose')

const DepositRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    method: { type: String, required: true },
    amount: { type: Number, required: true },
    bonus: { type: Number, default: 0 }, // deposit bonus credited on approval
    bonusPct: { type: Number, default: 0 }, // tier % at request time
    bonusCode: { type: String, default: '' }, // promo/bonus code used at request time
    senderNumber: { type: String, default: '' },
    screenshotPath: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports =
  mongoose.models.DepositRequest || mongoose.model('DepositRequest', DepositRequestSchema)
