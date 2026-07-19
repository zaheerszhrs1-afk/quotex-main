// Quotex-style deposit bonus codes. Server-side route uses the same file, so the
// client preview and credited amount always match.
const BONUS_ENABLED = true

const BONUS_CODES = [
  { code: 'WELCOME50', min: 30, pct: 50, title: '+50% BONUS if you deposit more than $30.00' },
  { code: 'DEPOSIT30', min: 80, pct: 30, title: '+30% BONUS if you deposit more than $80.00' },
  { code: 'DEPOSIT40', min: 90, pct: 40, title: '+40% BONUS if you deposit more than $90.00' },
  { code: 'DEPOSIT50', min: 120, pct: 50, title: '+50% BONUS if you deposit more than $120.00' },
]

// Backward-compatible export name for older UI pieces.
const BONUS_TIERS = BONUS_CODES.map(({ min, pct }) => ({ min, pct }))

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '')
}

function findBonusCode(code) {
  const clean = normalizeCode(code)
  if (!clean) return null
  return BONUS_CODES.find((b) => b.code === clean) || null
}

function bonusFor(amount, code = '') {
  if (!BONUS_ENABLED) return { pct: 0, bonus: 0, code: '', valid: false, min: 0 }
  const amt = Number(amount) || 0
  const b = findBonusCode(code)
  if (!b || amt < b.min) return { pct: 0, bonus: 0, code: normalizeCode(code), valid: false, min: b?.min || 0 }
  const bonus = Math.round(amt * (b.pct / 100) * 100) / 100
  return { pct: b.pct, bonus, code: b.code, valid: true, min: b.min }
}

module.exports = { BONUS_ENABLED, BONUS_CODES, BONUS_TIERS, bonusFor, findBonusCode, normalizeCode }
