const mongoose = require('mongoose')

const WithdrawRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    method: { type: String, required: true },
    amount: { type: Number, required: true },
    recipientDetails: { type: String, default: '' },
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
  mongoose.models.WithdrawRequest || mongoose.model('WithdrawRequest', WithdrawRequestSchema)
