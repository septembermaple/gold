/**
 * 重置管理员密码脚本
 * 在 Cloudflare Worker 中执行
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const { DB } = await import('cloudflare:workers')
  
  // 新密码
  const newPassword = 'admin123'
  
  // 生成哈希
  const salt = 'goldplatform2024'
  const hash = await computeHash(salt + newPassword)
  const passwordHash = `${salt}:${hash}`
  
  // 更新数据库
  await DB.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE username = 'admin'"
  )
    .bind(passwordHash)
    .run()
  
  return new Response(`管理员密码已重置为: ${newPassword}`, { status: 200 })
}

async function computeHash(input) {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
