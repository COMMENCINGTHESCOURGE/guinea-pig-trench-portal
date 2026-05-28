// Guinea Pig Trench — Cypher / Jam Session System
// Record voice over beats, play back, share with party
// ONLY ACTIVE WHEN IN-GAME + IN PROXIMITY TO OTHER PLAYERS
// No recording from lobby — you have to be playing together

class CypherRecorder {
  constructor() {
    this.mediaRecorder = null
    this.chunks = []
    this.recordings = []  // {blob, url, name, timestamp, duration}
    this.isRecording = false
    this.recordingStart = 0
    this.maxDuration = 60 * 1000  // 60 seconds max per recording
    this.stream = null

    // Proximity gate — cypher only works in-game near other players
    this.enabled = false
    this.inGame = false
    this.nearbyPeers = new Set()  // peers within proximity range
    this.proximityRadius = 300    // pixels — must be this close to jam

    this._bindUI()
  }

  // Called by game when player enters/exits
  setInGame(isInGame) {
    this.inGame = isInGame
    this._updateEnabled()
  }

  // Called by game with nearby player positions
  updateProximity(myX, myY, peerPositions) {
    // peerPositions: Map of peerId -> {x, y}
    this.nearbyPeers.clear()
    if (!peerPositions) return

    for (const [peerId, pos] of peerPositions) {
      const dist = Math.hypot(pos.x - myX, pos.y - myY)
      if (dist <= this.proximityRadius) {
        this.nearbyPeers.add(peerId)
      }
    }
    this._updateEnabled()
  }

  _updateEnabled() {
    const wasEnabled = this.enabled
    // Must be in a game AND have at least 1 nearby peer
    this.enabled = this.inGame && this.nearbyPeers.size > 0

    if (this.enabled && !wasEnabled) {
      this._showCypherUI()
    } else if (!this.enabled && wasEnabled) {
      this._hideCypherUI()
      // Stop recording if active
      if (this.isRecording) this.stopRecording()
    }
  }

  _showCypherUI() {
    const panel = document.getElementById('cypher-panel')
    if (panel) {
      panel.style.display = 'block'
      panel.querySelector('.cypher-status').textContent =
        `${this.nearbyPeers.size} player${this.nearbyPeers.size > 1 ? 's' : ''} nearby — JAM READY`
    }
  }

  _hideCypherUI() {
    const panel = document.getElementById('cypher-panel')
    if (panel) panel.style.display = 'none'
  }

  _bindUI() {
    // Will be called after DOM is ready
    document.addEventListener('DOMContentLoaded', () => this._createUI())
  }

  _createUI() {
    const partyPanel = document.getElementById('party-connected')
    if (!partyPanel) return

    const cypherDiv = document.createElement('div')
    cypherDiv.id = 'cypher-panel'
    cypherDiv.style.cssText = 'margin-top:12px;border-top:1px solid var(--border);padding-top:12px;'
    cypherDiv.style.display = 'none' // Hidden until in-game + proximity
    cypherDiv.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="color:var(--teal);font-size:11px;letter-spacing:.15em;text-transform:uppercase">JAM SESSION</span>
        <span id="cypher-timer" style="color:var(--teal-dim);font-size:10px">0:00</span>
      </div>
      <div class="cypher-status" style="color:var(--teal-dim);font-size:10px;margin-bottom:6px">Waiting for nearby players...</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button id="btn-cypher-record" class="btn btn-small" style="border-color:#ff4444;color:#ff4444">
          ● REC
        </button>
        <button id="btn-cypher-stop" class="btn btn-small" style="display:none">
          ■ STOP
        </button>
        <button id="btn-cypher-play-last" class="btn btn-small" style="display:none">
          ▶ PLAY LAST
        </button>
        <button id="btn-cypher-share" class="btn btn-small" style="display:none">
          ↑ SHARE
        </button>
      </div>
      <div id="cypher-recordings" style="max-height:120px;overflow-y:auto"></div>
    `

    partyPanel.appendChild(cypherDiv)

    // Bind buttons
    document.getElementById('btn-cypher-record')?.addEventListener('click', () => this.startRecording())
    document.getElementById('btn-cypher-stop')?.addEventListener('click', () => this.stopRecording())
    document.getElementById('btn-cypher-play-last')?.addEventListener('click', () => this.playLast())
    document.getElementById('btn-cypher-share')?.addEventListener('click', () => this.shareLast())
  }

  async startRecording() {
    // Gate: must be in-game and near other players
    if (!this.enabled) {
      console.log('Cypher blocked — must be in-game near other players')
      return
    }

    try {
      // Get mic if not already
      if (!this.stream) {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
          }
        })
      }

      this.chunks = []
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      })

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data)
      }

      this.mediaRecorder.onstop = () => this._onRecordingComplete()

      this.mediaRecorder.start(100) // collect data every 100ms
      this.isRecording = true
      this.recordingStart = Date.now()

      // Update UI
      const recBtn = document.getElementById('btn-cypher-record')
      recBtn.textContent = '● REC'
      recBtn.style.background = 'rgba(255,0,0,.2)'
      recBtn.style.animation = 'pulse-red 1s infinite'
      document.getElementById('btn-cypher-stop').style.display = 'inline-block'

      // Timer update
      this._timerInterval = setInterval(() => {
        const elapsed = Date.now() - this.recordingStart
        const sec = Math.floor(elapsed / 1000)
        const min = Math.floor(sec / 60)
        document.getElementById('cypher-timer').textContent =
          `${min}:${(sec % 60).toString().padStart(2, '0')}`

        // Auto-stop at max duration
        if (elapsed >= this.maxDuration) this.stopRecording()
      }, 100)

      // Add CSS animation if not exists
      if (!document.getElementById('cypher-styles')) {
        const style = document.createElement('style')
        style.id = 'cypher-styles'
        style.textContent = `
          @keyframes pulse-red {
            0%, 100% { border-color: #ff4444; }
            50% { border-color: #ff0000; box-shadow: 0 0 8px rgba(255,0,0,.3); }
          }
        `
        document.head.appendChild(style)
      }

      console.log('Cypher recording started')

    } catch (e) {
      console.error('Mic access failed:', e)
      alert('Could not access microphone for recording')
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return

    this.mediaRecorder.stop()
    this.isRecording = false
    clearInterval(this._timerInterval)

    // Reset UI
    const recBtn = document.getElementById('btn-cypher-record')
    recBtn.style.background = ''
    recBtn.style.animation = ''
    document.getElementById('btn-cypher-stop').style.display = 'none'
  }

  _onRecordingComplete() {
    const blob = new Blob(this.chunks, { type: 'audio/webm' })
    const url = URL.createObjectURL(blob)
    const duration = Date.now() - this.recordingStart
    const name = `cypher_${this.recordings.length + 1}`

    const recording = {
      blob,
      url,
      name,
      timestamp: Date.now(),
      duration,
      durationStr: `${Math.floor(duration / 60000)}:${((duration / 1000) % 60).toFixed(0).padStart(2, '0')}`,
    }

    this.recordings.push(recording)
    this._renderRecordings()

    // Show play/share buttons
    document.getElementById('btn-cypher-play-last').style.display = 'inline-block'
    document.getElementById('btn-cypher-share').style.display = 'inline-block'

    console.log(`Recording saved: ${name} (${recording.durationStr})`)
  }

  _renderRecordings() {
    const container = document.getElementById('cypher-recordings')
    if (!container) return

    container.innerHTML = this.recordings.map((rec, i) => `
      <div style="
        display:flex;align-items:center;gap:8px;
        padding:6px 8px;margin:3px 0;border-radius:4px;
        border:1px solid var(--border);font-size:11px;
      ">
        <button class="btn-icon cypher-play-btn" data-index="${i}" style="font-size:14px">▶</button>
        <span style="color:var(--teal);flex:1">${rec.name}</span>
        <span style="color:var(--text-dim);font-size:10px">${rec.durationStr}</span>
        <button class="btn-icon cypher-share-btn" data-index="${i}" title="Share to party" style="font-size:12px">↑</button>
        <button class="btn-icon cypher-download-btn" data-index="${i}" title="Download" style="font-size:12px">⬇</button>
        <button class="btn-icon cypher-loop-btn" data-index="${i}" title="Loop" style="font-size:12px">🔁</button>
      </div>
    `).join('')

    // Bind play buttons
    container.querySelectorAll('.cypher-play-btn').forEach(btn => {
      btn.addEventListener('click', () => this.play(parseInt(btn.dataset.index)))
    })

    // Bind share buttons
    container.querySelectorAll('.cypher-share-btn').forEach(btn => {
      btn.addEventListener('click', () => this.share(parseInt(btn.dataset.index)))
    })

    // Bind download buttons
    container.querySelectorAll('.cypher-download-btn').forEach(btn => {
      btn.addEventListener('click', () => this.download(parseInt(btn.dataset.index)))
    })

    // Bind loop buttons
    container.querySelectorAll('.cypher-loop-btn').forEach(btn => {
      btn.addEventListener('click', () => this.loop(parseInt(btn.dataset.index)))
    })
  }

  play(index) {
    if (index < 0 || index >= this.recordings.length) return

    // Stop any current playback
    if (this._currentAudio) {
      this._currentAudio.pause()
      this._currentAudio = null
    }

    const audio = new Audio(this.recordings[index].url)
    audio.play()
    this._currentAudio = audio
  }

  playLast() {
    if (this.recordings.length > 0) {
      this.play(this.recordings.length - 1)
    }
  }

  loop(index) {
    if (index < 0 || index >= this.recordings.length) return

    if (this._currentAudio) {
      this._currentAudio.pause()
    }

    const audio = new Audio(this.recordings[index].url)
    audio.loop = true
    audio.play()
    this._currentAudio = audio

    // Visual indicator
    const btns = document.querySelectorAll('.cypher-loop-btn')
    btns.forEach(b => b.style.color = '')
    btns[index].style.color = 'var(--teal)'
  }

  download(index) {
    if (index < 0 || index >= this.recordings.length) return

    const rec = this.recordings[index]
    const a = document.createElement('a')
    a.href = rec.url
    a.download = `${rec.name}_${new Date().toISOString().slice(0,10)}.webm`
    a.click()
  }

  async share(index) {
    if (index < 0 || index >= this.recordings.length) return
    if (typeof party === 'undefined' || !party.room) {
      alert('Join a party first to share recordings')
      return
    }

    const rec = this.recordings[index]

    // Convert blob to base64 for P2P transfer
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]

      // Send via Trystero
      if (party._sendCypherAudio) {
        party._sendCypherAudio({
          name: rec.name,
          data: base64,
          duration: rec.durationStr,
          from: typeof auth !== 'undefined' ? auth.displayName : 'Player',
        })

        // Chat notification
        if (party._sendChat) {
          party._sendChat({
            name: typeof auth !== 'undefined' ? auth.displayName : 'Player',
            text: `shared a cypher recording: ${rec.name} (${rec.durationStr})`
          })
        }

        console.log(`Shared ${rec.name} to party`)
      }
    }
    reader.readAsDataURL(rec.blob)
  }

  shareLast() {
    if (this.recordings.length > 0) {
      this.share(this.recordings.length - 1)
    }
  }

  // Called by party system when receiving a shared recording
  receiveRecording(data) {
    // Convert base64 back to blob
    const byteChars = atob(data.data)
    const byteArray = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i)
    }
    const blob = new Blob([byteArray], { type: 'audio/webm' })
    const url = URL.createObjectURL(blob)

    const recording = {
      blob,
      url,
      name: `${data.from}: ${data.name}`,
      timestamp: Date.now(),
      duration: 0,
      durationStr: data.duration,
    }

    this.recordings.push(recording)
    this._renderRecordings()

    // Auto-play received recording
    this.play(this.recordings.length - 1)
  }
}

const cypher = new CypherRecorder()

// Wire cypher into party system when party connects
if (typeof party !== 'undefined') {
  const origConnect = party._connectRoom.bind(party)
  party._connectRoom = async function(code) {
    await origConnect(code)

    // Add cypher data channel
    if (this.room) {
      const [sendCypher, onCypher] = this.room.makeAction('cypher')
      this._sendCypherAudio = sendCypher
      onCypher((data) => cypher.receiveRecording(data))
    }
  }
}
