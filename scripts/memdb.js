// Optional: run an in-memory MongoDB on a FIXED port so both the Next.js and
// Express processes share one database WITHOUT installing MongoDB.
//
//   npm run memdb        (keep this running in its own terminal)
//   npm run dev:mem      (runs memdb + next + server together)
//
// Data persists only while this process is alive.
const { MongoMemoryServer } = require('mongodb-memory-server')

const PORT = 27017

;(async () => {
  const mongod = await MongoMemoryServer.create({
    instance: { port: PORT, dbName: 'quotex-clone' },
  })
  const uri = mongod.getUri()
  console.log('\n  In-memory MongoDB ready:')
  console.log('  ' + uri)
  console.log('  (set MONGODB_URI=mongodb://localhost:' + PORT + '/quotex-clone)\n')

  const shutdown = async () => {
    await mongod.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
})().catch((e) => {
  console.error('memdb failed:', e)
  process.exit(1)
})
