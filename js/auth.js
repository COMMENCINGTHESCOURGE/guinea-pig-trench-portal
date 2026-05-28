// Guinea Pig Trench — Auth System (Supabase)
// Handles: email/password, Google OAuth, Discord OAuth, magic links
// Manages: user session, profile display, save/load game data

class Auth {
  constructor() {
    this.supabase = null
    this.user = null
    this.profile = null
    this.onAuthChange = null // callback

    this._initSupabase()
    this._bindUI()

    // Hide auth buttons if Supabase not configured
    if (this.offline) {
      const btns = document.getElementById('auth-buttons')
      if (btns) btns.style.display = 'none'
    }
  }

  _initSupabase() {
    if (CONFIG.SUPABASE_URL.includes('YOUR_PROJECT')) {
      console.warn('Supabase not configured — auth disabled. Update js/config.js')
      this.offline = true
      return
    }
    this.supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
    this.offline = false

    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        this.user = session.user
        this._loadProfile()
        this._showLoggedIn()
      } else {
        this.user = null
        this.profile = null
        this._showLoggedOut()
      }
      if (this.onAuthChange) this.onAuthChange(this.user)
    })

    // Check existing session
    this.supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        this.user = data.session.user
        this._loadProfile()
        this._showLoggedIn()
      }
    })
  }

  _bindUI() {
    const $ = id => document.getElementById(id)

    // Open login modal
    $('btn-login')?.addEventListener('click', () => {
      this._isSignUp = false
      this._showModal('Log In')
    })

    // Open signup modal
    $('btn-signup')?.addEventListener('click', () => {
      this._isSignUp = true
      this._showModal('Sign Up')
    })

    // Close modal
    $('auth-close')?.addEventListener('click', () => this._hideModal())

    // Submit email/password
    $('auth-submit')?.addEventListener('click', () => this._submitEmailAuth())

    // Enter key on password field
    $('auth-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._submitEmailAuth()
    })

    // Switch between login/signup
    $('auth-switch-link')?.addEventListener('click', e => {
      e.preventDefault()
      this._isSignUp = !this._isSignUp
      this._showModal(this._isSignUp ? 'Sign Up' : 'Log In')
    })

    // Social logins
    $('auth-google')?.addEventListener('click', () => this._socialLogin('google'))
    $('auth-discord')?.addEventListener('click', () => this._socialLogin('discord'))
    $('auth-magic')?.addEventListener('click', () => this._sendMagicLink())

    // Logout
    $('btn-logout')?.addEventListener('click', () => this.logout())

    // Click outside modal to close
    $('auth-modal')?.addEventListener('click', e => {
      if (e.target.id === 'auth-modal') this._hideModal()
    })
  }

  _showModal(title) {
    const $ = id => document.getElementById(id)
    $('auth-title').textContent = title
    $('auth-submit').textContent = title
    $('auth-switch-text').textContent = this._isSignUp
      ? 'Already have an account?'
      : "Don't have an account?"
    $('auth-switch-link').textContent = this._isSignUp ? 'Log In' : 'Sign Up'
    $('auth-error').textContent = ''
    $('auth-email').value = ''
    $('auth-password').value = ''
    $('auth-modal').style.display = 'flex'
    $('auth-email').focus()
  }

  _hideModal() {
    document.getElementById('auth-modal').style.display = 'none'
  }

  async _submitEmailAuth() {
    if (this.offline) {
      this._showError('Auth not configured — update js/config.js with Supabase credentials')
      return
    }

    const email = document.getElementById('auth-email').value.trim()
    const password = document.getElementById('auth-password').value

    if (!email || !password) {
      this._showError('Enter email and password')
      return
    }

    if (password.length < 6) {
      this._showError('Password must be at least 6 characters')
      return
    }

    try {
      let result
      if (this._isSignUp) {
        result = await this.supabase.auth.signUp({ email, password })
      } else {
        result = await this.supabase.auth.signInWithPassword({ email, password })
      }

      if (result.error) {
        this._showError(result.error.message)
      } else {
        this._hideModal()
        if (this._isSignUp) {
          this._showError('')
          alert('Check your email to confirm your account!')
        }
      }
    } catch (err) {
      this._showError('Connection error — try again')
    }
  }

  async _socialLogin(provider) {
    if (this.offline) {
      this._showError('Auth not configured')
      return
    }

    const { error } = await this.supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    })

    if (error) this._showError(error.message)
  }

  async _sendMagicLink() {
    if (this.offline) {
      this._showError('Auth not configured')
      return
    }

    const email = document.getElementById('auth-email').value.trim()
    if (!email) {
      this._showError('Enter your email first')
      return
    }

    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })

    if (error) {
      this._showError(error.message)
    } else {
      this._showError('')
      alert('Magic link sent! Check your email.')
      this._hideModal()
    }
  }

  async logout() {
    if (!this.offline) {
      await this.supabase.auth.signOut()
    }
    this.user = null
    this.profile = null
    this._showLoggedOut()
  }

  async _loadProfile() {
    if (this.offline || !this.user) return

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', this.user.id)
      .single()

    if (data) {
      this.profile = data
      this._updateProfileUI()
    } else if (error?.code === 'PGRST116') {
      // No profile yet — create one
      await this._createProfile()
    }
  }

  async _createProfile() {
    if (this.offline || !this.user) return

    const displayName = this.user.email?.split('@')[0] || 'Player'
    const { data, error } = await this.supabase
      .from('profiles')
      .insert({
        id: this.user.id,
        display_name: displayName,
        total_cores: 0,
        games_played: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (data) {
      this.profile = data
      this._updateProfileUI()
    }
  }

  _updateProfileUI() {
    const name = this.profile?.display_name || this.user?.email?.split('@')[0] || 'Player'
    const cores = this.profile?.total_cores || 0
    document.getElementById('user-name').textContent = name
    document.getElementById('user-cores').textContent = cores
  }

  _showLoggedIn() {
    document.getElementById('auth-buttons').style.display = 'none'
    document.getElementById('user-profile').style.display = 'flex'
    this._updateProfileUI()
  }

  _showLoggedOut() {
    document.getElementById('auth-buttons').style.display = 'flex'
    document.getElementById('user-profile').style.display = 'none'
  }

  _showError(msg) {
    document.getElementById('auth-error').textContent = msg
  }

  // ─── Game Data API ───────────────────────────────

  async saveGameData(gameId, data) {
    if (this.offline || !this.user) {
      // Fallback to localStorage
      localStorage.setItem(`gpt_save_${gameId}`, JSON.stringify(data))
      return true
    }

    const { error } = await this.supabase
      .from('saves')
      .upsert({
        user_id: this.user.id,
        game_id: gameId,
        data: data,
        updated_at: new Date().toISOString()
      })

    return !error
  }

  async loadGameData(gameId) {
    if (this.offline || !this.user) {
      const saved = localStorage.getItem(`gpt_save_${gameId}`)
      return saved ? JSON.parse(saved) : null
    }

    const { data, error } = await this.supabase
      .from('saves')
      .select('data')
      .eq('user_id', this.user.id)
      .eq('game_id', gameId)
      .single()

    return data?.data || null
  }

  async submitScore(gameId, score) {
    if (this.offline || !this.user) return false

    const { error } = await this.supabase
      .from('leaderboards')
      .insert({
        user_id: this.user.id,
        game_id: gameId,
        score: score,
        display_name: this.profile?.display_name || 'Anonymous',
        created_at: new Date().toISOString()
      })

    return !error
  }

  async getLeaderboard(gameId, limit = 50) {
    if (this.offline) return []

    const { data } = await this.supabase
      .from('leaderboards')
      .select('display_name, score, created_at')
      .eq('game_id', gameId)
      .order('score', { ascending: false })
      .limit(limit)

    return data || []
  }

  get isLoggedIn() {
    return !!this.user
  }

  get displayName() {
    return this.profile?.display_name || this.user?.email?.split('@')[0] || 'Guest'
  }
}

// Global instance
const auth = new Auth()
