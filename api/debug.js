export default async function handler(req, res) {
  try {
    const safeEnv = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasLineChannelId: !!process.env.LINE_CHANNEL_ID,
      hasChannelAccessToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN
    };
    return res.status(200).json({ status: 'ok', node: process.version, env: safeEnv });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
