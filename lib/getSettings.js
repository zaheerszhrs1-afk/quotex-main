const PaymentSettings = require('./models/PaymentSettings')

// Mirrors the real Quotex (Pakistan region) cashier: E-Pay wallets, banks, and
// several crypto networks. `logo` maps to a brand icon in components/trade/PaymentLogo.
const DEFAULT_METHODS = [
  // E-Pay wallets
  { name: 'Easypaisa (P2C)', type: 'mobile', logo: 'easypaisa', popular: true, isEnabled: true, minAmount: 10, number: '0300-0000000', accountTitle: 'Quotex' },
  { name: 'EasyPaisa', type: 'mobile', logo: 'easypaisa', popular: true, isEnabled: true, minAmount: 10, number: '0300-0000000', accountTitle: 'Quotex' },
  { name: 'JazzCash', type: 'mobile', logo: 'jazzcash', popular: true, isEnabled: true, minAmount: 10, number: '0300-0000000', accountTitle: 'Quotex' },
  { name: 'Jazzcash (P2C)', type: 'mobile', logo: 'jazzcash', popular: true, isEnabled: true, minAmount: 10, number: '0300-0000000', accountTitle: 'Quotex' },
  { name: 'CashMaal', type: 'mobile', logo: 'cashmaal', popular: false, isEnabled: true, minAmount: 10, number: '0300-0000000', accountTitle: 'Quotex' },
  // Binance
  { name: 'Binance Pay', type: 'crypto', logo: 'binance', popular: true, isEnabled: true, minAmount: 10, walletAddress: 'binance-pay-id-000000' },
  // Banks
  { name: 'Bank Transfer', type: 'bank', logo: 'bank', popular: false, isEnabled: true, minAmount: 50, accountTitle: 'Quotex Pvt Ltd', accountNumber: 'PK00BANK0000000000000000' },
  { name: 'Bank Card (Visa / Mastercard)', type: 'bank', logo: 'visa', popular: true, isEnabled: true, minAmount: 50, accountTitle: 'Quotex Pvt Ltd', accountNumber: '0000 0000 0000 0000' },
  // Crypto networks
  { name: 'USDT (TRC-20)', type: 'crypto', logo: 'usdt', popular: true, isEnabled: true, minAmount: 15, walletAddress: 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { name: 'USDT (BEP-20)', type: 'crypto', logo: 'usdt', popular: true, isEnabled: true, minAmount: 20, walletAddress: '0x0000000000000000000000000000000000000000' },
  { name: 'USDT (ERC-20)', type: 'crypto', logo: 'usdt', popular: true, isEnabled: true, minAmount: 50, walletAddress: '0x0000000000000000000000000000000000000000' },
  { name: 'Bitcoin', type: 'crypto', logo: 'btc', popular: false, isEnabled: true, minAmount: 20, walletAddress: 'bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { name: 'Ethereum', type: 'crypto', logo: 'eth', popular: false, isEnabled: true, minAmount: 30, walletAddress: '0x0000000000000000000000000000000000000000' },
]

// Returns the singleton settings doc, creating it with defaults if missing.
async function getSettings() {
  let doc = await PaymentSettings.findOne({ singleton: 'main' })
  if (!doc) {
    doc = await PaymentSettings.create({
      singleton: 'main',
      methods: DEFAULT_METHODS,
      minDeposit: 10,
      minWithdrawal: 200,
      announcement: '',
    })
  }
  return doc
}

// Refreshes the method list to the full default set while preserving any
// credentials (numbers / wallet addresses) the admin already entered for a
// method of the same name. Used by the seed script so re-seeding an existing DB
// still populates the Banks / Crypto categories.
async function syncMethods() {
  const doc = await getSettings()
  const existing = Object.fromEntries((doc.methods || []).map((m) => [m.name, m]))
  doc.methods = DEFAULT_METHODS.map((d) => {
    const prev = existing[d.name]
    if (!prev) return d
    return {
      ...d,
      number: prev.number || d.number,
      accountTitle: prev.accountTitle || d.accountTitle,
      accountNumber: prev.accountNumber || d.accountNumber,
      walletAddress: prev.walletAddress || d.walletAddress,
    }
  })
  await doc.save()
  return doc
}

module.exports = { getSettings, syncMethods, DEFAULT_METHODS }
