// Guinea Pig Trench — Configuration
// Replace these with your actual Supabase credentials after setup

const CONFIG = {
  // Supabase (free tier — supabase.com → New Project)
  // 1. Create project at supabase.com
  // 2. Go to Settings → API → copy URL and anon key
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_KEY',

  // Trystero (no config needed — uses public BitTorrent trackers)
  APP_ID: 'guinea-pig-trench-v1',

  // Site
  SITE_NAME: 'Guinea Pig Trench',
  AUTHOR: 'ohthatsthe / skippyohms',
}

// Validate config at load time
;(() => {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_URL.startsWith('https://')) {
    console.warn('CONFIG: SUPABASE_URL should start with https:// — got:', CONFIG.SUPABASE_URL)
  }
  if (CONFIG.SUPABASE_URL.includes('YOUR_PROJECT')) {
    console.warn('CONFIG: SUPABASE_URL still has placeholder value — replace with your actual Supabase project URL')
  }
  if (!CONFIG.SUPABASE_ANON_KEY || CONFIG.SUPABASE_ANON_KEY === 'YOUR_ANON_KEY') {
    console.warn('CONFIG: SUPABASE_ANON_KEY still has placeholder value — replace with your actual anon key')
  }
})()
