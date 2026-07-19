const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: '' }, // empty for OAuth-only accounts
    // No `default: null` — a sparse+unique index ignores docs where the field is
    // ABSENT, but a literal `null` is an indexed value. Defaulting to null made the
    // 2nd email signup collide with the 1st on `googleId: null` (E11000 → 500).
    // Leaving it undefined for email accounts keeps them out of the index entirely;
    // OAuth accounts set it to a real string.
    googleId: { type: String, index: { unique: true, sparse: true } },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    demoBalance: { type: Number, default: 10000 },
    realBalance: { type: Number, default: 0 },
    country: { type: String, default: '' },
    currency: { type: String, default: 'USD' },
    isBanned: { type: Boolean, default: false },
    // profile (My account)
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    dob: { type: String, default: '' }, // YYYY-MM-DD
    address: { type: String, default: '' },
  },
  { timestamps: true }
)

UserSchema.methods.toSafeJSON = function () {
  return {
    id: this._id.toString(),
    email: this.email,
    role: this.role,
    demoBalance: this.demoBalance,
    realBalance: this.realBalance,
    country: this.country,
    currency: this.currency,
    isBanned: this.isBanned,
    firstName: this.firstName,
    lastName: this.lastName,
    dob: this.dob,
    address: this.address,
    createdAt: this.createdAt,
  }
}

module.exports = mongoose.models.User || mongoose.model('User', UserSchema)
