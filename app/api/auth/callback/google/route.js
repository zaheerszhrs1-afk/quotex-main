// Alias route: some OAuth configs register the NextAuth-style callback path
// (/api/auth/callback/google). This re-exports the real handler that lives at
// /api/auth/google/callback so either URL works.
export { GET, dynamic } from '../../google/callback/route'
