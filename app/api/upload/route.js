import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
const { getUserFromRequest } = require('@/lib/serverAuth')

// Uploads a payment screenshot. If Cloudinary env vars are configured the
// file goes to Cloudinary (persistent across redeploys) and the returned
// path is the secure https URL — stored as-is in DepositRequest.screenshotPath.
// Without Cloudinary config it falls back to /public/uploads (local dev).
//
// Env (either form works):
//   CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
// or CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
// Optional: CLOUDINARY_FOLDER (default "quotex/payments")

function cloudinaryConfig() {
  let cloud = process.env.CLOUDINARY_CLOUD_NAME
  let key = process.env.CLOUDINARY_API_KEY
  let secret = process.env.CLOUDINARY_API_SECRET
  const url = process.env.CLOUDINARY_URL
  if ((!cloud || !key || !secret) && url) {
    const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/)
    if (m) {
      key = key || m[1]
      secret = secret || m[2]
      cloud = cloud || m[3]
    }
  }
  return cloud && key && secret ? { cloud, key, secret } : null
}

async function uploadToCloudinary(file, cfg, userId) {
  const timestamp = Math.floor(Date.now() / 1000)
  const folder = process.env.CLOUDINARY_FOLDER || 'quotex/payments'
  const publicId = `${userId}_${Date.now()}`
  // signature: sha1 over the alphabetically sorted params + api secret
  const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${cfg.secret}`
  const signature = crypto.createHash('sha1').update(toSign).digest('hex')

  const fd = new FormData()
  fd.append('file', file)
  fd.append('api_key', cfg.key)
  fd.append('timestamp', String(timestamp))
  fd.append('folder', folder)
  fd.append('public_id', publicId)
  fd.append('signature', signature)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, {
    method: 'POST',
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message || `Cloudinary upload failed (${res.status})`)
  }
  return data.secure_url
}

export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 5MB).' }, { status: 400 })
  }
  if (file.type && !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed.' }, { status: 400 })
  }

  const cfg = cloudinaryConfig()
  if (cfg) {
    try {
      const url = await uploadToCloudinary(file, cfg, user._id.toString())
      return NextResponse.json({ path: url })
    } catch (e) {
      // Cloudinary configured but failed at runtime — don't error out, fall back
      // to local storage so the user's upload still succeeds.
      console.error('[upload] cloudinary failed, falling back to local:', e.message)
    }
  }

  // local fallback — used when Cloudinary env vars are not provided, or when a
  // configured Cloudinary upload failed. Files do not survive redeploys in
  // production, but this keeps the flow working without throwing.
  try {
    const bytes = Buffer.from(await file.arrayBuffer())
    const dir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(dir, { recursive: true })
    const ext = (file.name?.split('.').pop() || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 5)
    const name = `${user._id}_${Date.now()}.${ext}`
    await writeFile(path.join(dir, name), bytes)
    return NextResponse.json({ path: `/uploads/${name}` })
  } catch (e) {
    console.error('[upload] local fallback failed:', e.message)
    return NextResponse.json({ error: 'Upload failed. Try again.' }, { status: 500 })
  }
}
