const mongoose = require('mongoose')

// Append-only log of every sensitive admin action (money edits, bans, role
// changes, deposit/withdrawal decisions, forced trade outcomes). This is the
// accountability trail for a money platform: who did what, to whom, when.
// Written fire-and-forget on each action; never read in any hot loop.
const AdminAuditSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    adminEmail: { type: String, default: '' }, // denormalised for fast display
    action: { type: String, required: true, index: true }, // e.g. 'user.setBalance'
    target: { type: String, default: '' }, // who/what was acted on (email / id / symbol)
    summary: { type: String, default: '' }, // human-readable one-liner
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }, // before/after, amounts…
  },
  { timestamps: true }
)

module.exports = mongoose.models.AdminAudit || mongoose.model('AdminAudit', AdminAuditSchema)
