const AdminAudit = require('./models/AdminAudit')

// Record one admin action. Never throws — auditing must not break the action it
// records. Used by both the Next.js admin REST routes and the WS force handlers.
async function logAdmin({ adminId, adminEmail = '', action, target = '', summary = '', meta = {} }) {
  try {
    await AdminAudit.create({ adminId, adminEmail, action, target, summary, meta })
  } catch (e) {
    console.warn('[audit] failed to log', action, '-', e.message)
  }
}

module.exports = { logAdmin }
