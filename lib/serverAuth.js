// Helpers used inside Next.js Route Handlers to resolve the current user.
const connectDB = require('./db')
const User = require('./models/User')
const { verifyAccessToken, COOKIE } = require('./auth')

// Reads the access token from a NextRequest and returns the User doc (or null).
async function getUserFromRequest(request) {
  const token = request.cookies.get(COOKIE.ACCESS)?.value
  if (!token) return null
  const payload = verifyAccessToken(token)
  if (!payload?.sub) return null
  await connectDB();
  const user = await User.findById(payload.sub)
  if (!user || user.isBanned) return null
  return user
}

module.exports = { getUserFromRequest }
