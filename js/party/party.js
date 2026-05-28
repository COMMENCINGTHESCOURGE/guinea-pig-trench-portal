// Guinea Pig Trench — Party System (Trystero P2P)
// Voice, text, video chat with room codes

class PartyChat {
  constructor() {
    this.room = null
    this.roomCode = null
    this.peers = new Map() // peerId -> { name, audio, video }
    this.localStream = null
    this.micEnabled = false
    this.camEnabled = false
    this.peerAudios = {}

    this._bindUI()
  }

  _bindUI() {
    const $ = id => document.getElementById(id)

    $('btn-create-party')?.addEventListener('click', () => this.createRoom())
    $('btn-join-party')?.addEventListener('click', () => {
      const code = $('party-code-input').value.trim().toUpperCase()
      if (code.length >= 4) this.joinRoom(code)
    })
    $('party-code-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') $('btn-join-party').click()
    })

    $('btn-copy-code')?.addEventListener('click', () => {
      navigator.clipboard.writeText(this.roomCode)
      $('btn-copy-code').textContent = 'Copied!'
      setTimeout(() => $('btn-copy-code').textContent = 'Copy', 2000)
    })

    $('btn-leave-party')?.addEventListener('click', () => this.leave())
    $('btn-mic-toggle')?.addEventListener('click', () => this.toggleMic())
    $('btn-cam-toggle')?.addEventListener('click', () => this.toggleCam())

    $('btn-party-send')?.addEventListener('click', () => this.sendChat())
    $('party-chat-text')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.sendChat()
    })
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  async createRoom() {
    this.roomCode = this.generateCode()
    await this._connectRoom(this.roomCode)
  }

  async joinRoom(code) {
    this.roomCode = code
    await this._connectRoom(code)
  }

  async _connectRoom(code) {
    if (typeof trystero === 'undefined') {
      console.warn('Trystero not loaded')
      alert('Party system loading — try again in a moment')
      return
    }

    try {
      this.room = trystero.joinRoom({ appId: CONFIG.APP_ID }, code)
    } catch (e) {
      console.error('Room join failed:', e)
      return
    }

    // Set up data actions
    const [sendChat, onChat] = this.room.makeAction('chat')
    const [sendName, onName] = this.room.makeAction('name')
    this._sendChat = sendChat
    this._sendName = sendName

    // Receive chat
    onChat((data, peerId) => {
      this._addChatMessage(data.name, data.text)
    })

    // Receive names
    onName((name, peerId) => {
      const peer = this.peers.get(peerId) || {}
      peer.name = name
      this.peers.set(peerId, peer)
      this._updateMemberList()
    })

    // Peer events
    this.room.onPeerJoin(peerId => {
      this.peers.set(peerId, { name: 'Player' })
      this._sendName(auth.displayName)
      this._addChatMessage('System', 'A player joined the party')
      this._updateMemberList()
    })

    this.room.onPeerLeave(peerId => {
      const name = this.peers.get(peerId)?.name || 'Player'
      this.peers.delete(peerId)
      // Clean up audio/video
      if (this.peerAudios[peerId]) {
        this.peerAudios[peerId].pause()
        delete this.peerAudios[peerId]
      }
      this._addChatMessage('System', `${name} left the party`)
      this._updateMemberList()
    })

    // Receive audio/video streams
    this.room.onPeerStream((stream, peerId) => {
      // Check if stream has audio
      if (stream.getAudioTracks().length > 0) {
        const audio = new Audio()
        audio.srcObject = stream
        audio.play().catch(() => {})
        this.peerAudios[peerId] = audio
      }
      // Check if stream has video
      if (stream.getVideoTracks().length > 0) {
        this._addPeerVideo(stream, peerId)
      }
    })

    // Send our name
    setTimeout(() => this._sendName(auth.displayName), 500)

    // Show connected UI
    this._showConnected()
  }

  sendChat() {
    const input = document.getElementById('party-chat-text')
    const text = input.value.trim()
    if (!text || !this._sendChat) return

    this._sendChat({ name: auth.displayName, text })
    this._addChatMessage(auth.displayName, text)
    input.value = ''
  }

  async toggleMic() {
    const btn = document.getElementById('btn-mic-toggle')

    if (!this.micEnabled) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        })
        this.room.addStream(this.localStream)
        this.micEnabled = true
        btn.textContent = 'Mic: ON'
        btn.style.borderColor = 'var(--teal)'
      } catch (e) {
        console.error('Mic error:', e)
        alert('Could not access microphone')
      }
    } else {
      this.localStream?.getAudioTracks().forEach(t => t.enabled = !t.enabled)
      const on = this.localStream?.getAudioTracks()[0]?.enabled
      btn.textContent = on ? 'Mic: ON' : 'Mic: MUTED'
    }
  }

  async toggleCam() {
    const btn = document.getElementById('btn-cam-toggle')

    if (!this.camEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 160, height: 120, facingMode: 'user' }
        })
        this.room.addStream(stream)
        this.camEnabled = true
        btn.textContent = 'Cam: ON'

        // Show local preview
        this._addPeerVideo(stream, 'local')
      } catch (e) {
        console.error('Camera error:', e)
      }
    } else {
      // Toggle existing video tracks
      const videos = document.querySelectorAll('#peer-cams video')
      videos.forEach(v => {
        if (v.dataset.peer === 'local') {
          v.srcObject?.getVideoTracks().forEach(t => t.enabled = !t.enabled)
        }
      })
    }
  }

  _addPeerVideo(stream, peerId) {
    const container = document.getElementById('peer-cams')
    const video = document.createElement('video')
    video.srcObject = stream
    video.autoplay = true
    video.muted = peerId === 'local'
    video.dataset.peer = peerId
    video.style.width = '120px'
    container.appendChild(video)
  }

  leave() {
    if (this.room) {
      this.room.leave()
      this.room = null
    }
    this.localStream?.getTracks().forEach(t => t.stop())
    this.localStream = null
    this.peers.clear()
    this.peerAudios = {}
    this.micEnabled = false
    this.camEnabled = false
    this.roomCode = null

    document.getElementById('peer-cams').innerHTML = ''
    document.getElementById('party-chat-log').innerHTML = ''
    this._showDisconnected()
  }

  _showConnected() {
    document.getElementById('party-not-connected').style.display = 'none'
    document.getElementById('party-connected').style.display = 'block'
    document.getElementById('party-room-code').textContent = this.roomCode
    document.getElementById('btn-mic-toggle').textContent = 'Mic: OFF'
    document.getElementById('btn-cam-toggle').textContent = 'Cam: OFF'
    this._addChatMessage('System', `Party created! Code: ${this.roomCode}`)
    this._updateMemberList()
  }

  _showDisconnected() {
    document.getElementById('party-not-connected').style.display = 'block'
    document.getElementById('party-connected').style.display = 'none'
  }

  _addChatMessage(name, text) {
    const log = document.getElementById('party-chat-log')
    const div = document.createElement('div')
    div.innerHTML = `<span class="chat-name">${name}:</span> <span class="chat-msg">${this._escapeHtml(text)}</span>`
    log.appendChild(div)
    log.scrollTop = log.scrollHeight
  }

  _updateMemberList() {
    const container = document.getElementById('party-members')
    const members = [auth.displayName + ' (you)']
    this.peers.forEach(peer => members.push(peer.name || 'Player'))
    container.innerHTML = members.map(m =>
      `<span class="member-tag">${m}</span>`
    ).join('')
  }

  _escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

const party = new PartyChat()
