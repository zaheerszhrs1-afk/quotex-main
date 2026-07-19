// Shared Mongoose connection — cached so Next.js hot-reload and API routes
// reuse a single connection. Also used by the Express server.
const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quotex-clone'

let cached = global._mongoose
if (!cached) cached = global._mongoose = { conn: null, promise: null }

async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    mongoose.set('strictQuery', true)
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
      })
      .then((m) => {
        console.log('[db] connected:', MONGODB_URI)
        return m
      })
      .catch((err) => {
        cached.promise = null
        console.error('[db] connection error:', err.message)
        console.error(
          '[db] Is MongoDB running? Install it, or run "npm run memdb" in another terminal (then use dev:mem).'
        )
        throw err
      })
  }
  cached.conn = await cached.promise
  return cached.conn
}

module.exports = connectDB
module.exports.connectDB = connectDB
