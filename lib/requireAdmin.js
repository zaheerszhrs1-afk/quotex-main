const { getUserFromRequest } = require('./serverAuth')

// Returns the admin user, or null if the request is not from an admin.
async function requireAdmin(request) {
  const user = await getUserFromRequest(request)
  if (!user || user.role !== 'admin') return null
  return user
}

module.exports = { requireAdmin }
