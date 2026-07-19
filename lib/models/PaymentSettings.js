const mongoose = require('mongoose')

const MethodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // JazzCash, EasyPaisa, Binance Pay, USDT (TRC-20)…
    type: { type: String, default: 'mobile' }, // mobile (E-Pay) | bank | crypto
    isEnabled: { type: Boolean, default: false },
    popular: { type: Boolean, default: false }, // shown in the "Popular in your region" group
    minAmount: { type: Number, default: 0 }, // per-method minimum (0 = use global minDeposit)
    logo: { type: String, default: '' }, // logo key (jazzcash, easypaisa, binance, usdt, btc…)
    number: { type: String, default: '' },
    accountTitle: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    walletAddress: { type: String, default: '' },
  },
  { _id: false }
)

const PaymentSettingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'main', unique: true },
    methods: { type: [MethodSchema], default: [] },
    minDeposit: { type: Number, default: 100 },
    minWithdrawal: { type: Number, default: 200 },
    announcement: { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports =
  mongoose.models.PaymentSettings || mongoose.model('PaymentSettings', PaymentSettingsSchema)
