// Guinea Pig Trench — Telemetry System
// Comprehensive event tracking: pages, games, music, party, node editor, perf, errors
// Complements analytics.js (which tracks aggregated music/game stats)
// This tracks individual events with timestamps for flow analysis

const Telemetry = (() => {
  const STORAGE_KEY = 'gpt_telemetry';
  const OPT_OUT_KEY = 'gpt_telemetry_optout';
  const MAX_EVENTS = 1000;
  const FLUSH_INTERVAL = 30000;
  const SESSION_ID = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

  let eventBuffer = [];
  let flushTimer = null;
  let sessionStart = Date.now();

  // ── Helpers ──
  function isOptedOut() {
    try { return localStorage.getItem(OPT_OUT_KEY) === '1'; } catch { return false; }
  }

  function getDeviceInfo() {
    const ua = navigator.userAgent;
    const isMobile = /Mobi|Android|iPhone/i.test(ua);
    return {
      browser: /Firefox/i.test(ua) ? 'Firefox' : /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'Other',
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      device: isMobile ? 'mobile' : 'desktop',
      referrer: document.referrer || 'direct',
    };
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveStore(events) {
    try {
      // FIFO: keep only the last MAX_EVENTS
      if (events.length > MAX_EVENTS) events = events.slice(events.length - MAX_EVENTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {}
  }

  // ── Core API ──
  function track(eventName, properties = {}) {
    if (isOptedOut()) return;
    const evt = {
      ts: Date.now(),
      sid: SESSION_ID,
      event: eventName,
      props: properties,
    };
    eventBuffer.push(evt);
  }

  function flush() {
    if (eventBuffer.length === 0) return;
    const store = loadStore();
    store.push(...eventBuffer);
    saveStore(store);
    eventBuffer = [];
  }

  function optOut() {
    try { localStorage.setItem(OPT_OUT_KEY, '1'); } catch {}
    eventBuffer = [];
    console.log('Telemetry opted out.');
  }

  function optIn() {
    try { localStorage.removeItem(OPT_OUT_KEY); } catch {}
    console.log('Telemetry opted in.');
  }

  function exportData() {
    flush();
    return loadStore();
  }

  function clearData() {
    eventBuffer = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    console.log('Telemetry data cleared.');
  }

  // ── Dashboard (console) ──
  function dashboard() {
    flush();
    const events = loadStore();
    const sessions = new Set(events.map(e => e.sid));
    const totalMs = events.length > 1 ? events[events.length - 1].ts - events[0].ts : 0;

    console.log(`\n====== TELEMETRY DASHBOARD ======`);
    console.log(`Total events: ${events.length}`);
    console.log(`Total sessions: ${sessions.size}`);
    console.log(`Data spans: ${(totalMs / 3600000).toFixed(1)} hours`);

    // Event breakdown
    const counts = {};
    events.forEach(e => { counts[e.event] = (counts[e.event] || 0) + 1; });
    console.log('\n-- Event Counts --');
    console.table(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([ev, c]) => ({ Event: ev, Count: c })));

    // Game sessions
    const gameLaunches = events.filter(e => e.event === 'game:launch');
    if (gameLaunches.length > 0) {
      const gCounts = {};
      gameLaunches.forEach(e => { gCounts[e.props.gameId || 'unknown'] = (gCounts[e.props.gameId || 'unknown'] || 0) + 1; });
      console.log('\n-- Most Played Games --');
      console.table(Object.entries(gCounts).sort((a, b) => b[1] - a[1]).map(([g, c]) => ({ Game: g, Launches: c })));
    }

    // Errors
    const errors = events.filter(e => e.event === 'error');
    if (errors.length > 0) {
      console.log('\n-- Recent Errors --');
      errors.slice(-10).forEach(e => console.log(`  [${new Date(e.ts).toLocaleString()}] ${e.props.message}`));
    }

    console.log(`==================================\n`);
  }

  // ── Auto-tracking ──
  function initAutoTracking() {
    if (isOptedOut()) return;

    // Session start
    track('session:start', getDeviceInfo());

    // Page visibility
    document.addEventListener('visibilitychange', () => {
      track(document.hidden ? 'page:hidden' : 'page:visible', { elapsed: Date.now() - sessionStart });
    });

    // Errors
    window.addEventListener('error', (e) => {
      track('error', { message: e.message || 'Unknown error', filename: e.filename, line: e.lineno, col: e.colno });
    });

    window.addEventListener('unhandledrejection', (e) => {
      track('error', { message: 'Unhandled promise: ' + (e.reason?.message || String(e.reason)) });
    });

    // Page unload — flush
    window.addEventListener('beforeunload', () => {
      track('session:end', { duration: Date.now() - sessionStart });
      flush();
    });

    // Performance entries (load times)
    if (window.PerformanceObserver) {
      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              track('perf:navigation', {
                domContentLoaded: Math.round(entry.domContentLoadedEventEnd),
                loadComplete: Math.round(entry.loadEventEnd),
                domInteractive: Math.round(entry.domInteractive),
              });
            } else if (entry.entryType === 'largest-contentful-paint') {
              track('perf:lcp', { time: Math.round(entry.startTime) });
            }
          }
        });
        obs.observe({ type: 'navigation', buffered: true });
        obs.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}
    }

    // Periodic FPS + memory sampling
    let lastFrameTime = performance.now();
    let frameCount = 0;
    const fpsSampler = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastFrameTime >= 5000) {
        const fps = Math.round(frameCount / ((now - lastFrameTime) / 1000));
        const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
        track('perf:sample', { fps, memMB: mem });
        frameCount = 0;
        lastFrameTime = now;
      }
      requestAnimationFrame(fpsSampler);
    };
    requestAnimationFrame(fpsSampler);

    // Flush timer
    flushTimer = setInterval(flush, FLUSH_INTERVAL);
  }

  // ── Visual Dashboard (overlay) ──
  function showDashboardOverlay() {
    if (document.getElementById('telemetry-overlay')) {
      document.getElementById('telemetry-overlay').remove();
      return;
    }
    flush();
    const events = loadStore();

    const overlay = document.createElement('div');
    overlay.id = 'telemetry-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.92);color:#e0e0e0;font-family:Courier New,monospace;font-size:12px;overflow-y:auto;padding:20px;';

    // Header
    const sessions = new Set(events.map(e => e.sid));
    const totalPlayMs = events.filter(e => e.event === 'session:end').reduce((a, e) => a + (e.props.duration || 0), 0);

    // Game counts for bar chart
    const gameLaunches = {};
    events.filter(e => e.event === 'game:launch').forEach(e => {
      const gid = e.props.gameId || '?';
      gameLaunches[gid] = (gameLaunches[gid] || 0) + 1;
    });

    // Music stats
    const musicPlays = events.filter(e => e.event === 'music:play').length;
    const musicSkips = events.filter(e => e.event === 'music:skip').length;

    // Error log
    const errors = events.filter(e => e.event === 'error').slice(-20);

    // Perf samples
    const perfSamples = events.filter(e => e.event === 'perf:sample').slice(-30);

    let html = `
      <div style="max-width:900px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h1 style="color:#00d2ff;font-size:18px;margin:0;">TELEMETRY DASHBOARD</h1>
          <div>
            <button id="telem-export" style="background:#00d2ff;color:#000;border:none;padding:6px 14px;cursor:pointer;font-family:inherit;margin-right:8px;">EXPORT JSON</button>
            <button id="telem-close" style="background:#ff4060;color:#fff;border:none;padding:6px 14px;cursor:pointer;font-family:inherit;">CLOSE</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
          <div style="background:#1a1a2e;padding:12px;border-radius:4px;text-align:center;">
            <div style="color:#00d2ff;font-size:22px;font-weight:bold;">${sessions.size}</div>
            <div style="color:#888;font-size:10px;">SESSIONS</div>
          </div>
          <div style="background:#1a1a2e;padding:12px;border-radius:4px;text-align:center;">
            <div style="color:#ffd700;font-size:22px;font-weight:bold;">${(totalPlayMs / 60000).toFixed(0)}m</div>
            <div style="color:#888;font-size:10px;">TOTAL TIME</div>
          </div>
          <div style="background:#1a1a2e;padding:12px;border-radius:4px;text-align:center;">
            <div style="color:#ff60a0;font-size:22px;font-weight:bold;">${events.length}</div>
            <div style="color:#888;font-size:10px;">EVENTS</div>
          </div>
          <div style="background:#1a1a2e;padding:12px;border-radius:4px;text-align:center;">
            <div style="color:#ff4040;font-size:22px;font-weight:bold;">${errors.length}</div>
            <div style="color:#888;font-size:10px;">ERRORS</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <h3 style="color:#ffd700;margin-bottom:8px;">MOST PLAYED GAMES</h3>
            <canvas id="telem-games-chart" width="400" height="200" style="width:100%;background:#0c0c18;border-radius:4px;"></canvas>
          </div>
          <div>
            <h3 style="color:#ff60a0;margin-bottom:8px;">MUSIC STATS</h3>
            <div style="background:#0c0c18;padding:12px;border-radius:4px;height:200px;display:flex;flex-direction:column;justify-content:center;">
              <div>Plays: <span style="color:#00d2ff">${musicPlays}</span></div>
              <div>Skips: <span style="color:#ff4040">${musicSkips}</span></div>
              <div>Skip Rate: <span style="color:#ffd700">${musicPlays > 0 ? Math.round(musicSkips / musicPlays * 100) : 0}%</span></div>
            </div>
          </div>
        </div>

        <div style="margin-top:16px;">
          <h3 style="color:#ff60a0;margin-bottom:8px;">PERFORMANCE TIMELINE</h3>
          <canvas id="telem-perf-chart" width="800" height="120" style="width:100%;background:#0c0c18;border-radius:4px;"></canvas>
        </div>

        <div style="margin-top:16px;">
          <h3 style="color:#ff4040;margin-bottom:8px;">ERROR LOG</h3>
          <div style="background:#0c0c18;padding:10px;border-radius:4px;max-height:160px;overflow-y:auto;font-size:11px;">
            ${errors.length === 0 ? '<div style="color:#555;">No errors recorded.</div>' :
              errors.map(e => `<div style="margin-bottom:4px;"><span style="color:#555;">${new Date(e.ts).toLocaleString()}</span> <span style="color:#ff4040;">${(e.props.message || '').slice(0, 120)}</span></div>`).join('')}
          </div>
        </div>
      </div>
    `;
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // Draw games bar chart
    const gCanvas = document.getElementById('telem-games-chart');
    if (gCanvas) {
      const gc = gCanvas.getContext('2d');
      const entries = Object.entries(gameLaunches).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const maxVal = entries.length > 0 ? Math.max(...entries.map(e => e[1])) : 1;
      const barW = gCanvas.width / Math.max(entries.length, 1) - 8;
      entries.forEach(([name, count], i) => {
        const barH = (count / maxVal) * 150;
        const x = i * (barW + 8) + 8;
        const y = 180 - barH;
        gc.fillStyle = '#00d2ff';
        gc.fillRect(x, y, barW, barH);
        gc.fillStyle = '#888';
        gc.font = '9px Courier New';
        gc.textAlign = 'center';
        gc.fillText(name.slice(0, 10), x + barW / 2, 196);
        gc.fillStyle = '#fff';
        gc.fillText(count, x + barW / 2, y - 4);
      });
    }

    // Draw perf chart
    const pCanvas = document.getElementById('telem-perf-chart');
    if (pCanvas && perfSamples.length > 1) {
      const pc = pCanvas.getContext('2d');
      const maxFps = 120;
      perfSamples.forEach((s, i) => {
        const x = (i / (perfSamples.length - 1)) * pCanvas.width;
        const fps = s.props.fps || 0;
        const y = pCanvas.height - (fps / maxFps) * pCanvas.height;
        pc.fillStyle = fps >= 55 ? '#40ff60' : fps >= 30 ? '#ffd700' : '#ff4040';
        pc.fillRect(x, y, Math.max(pCanvas.width / perfSamples.length - 1, 2), pCanvas.height - y);
      });
      pc.fillStyle = '#555';
      pc.font = '9px Courier New';
      pc.fillText('60fps', 4, pCanvas.height - (60 / maxFps) * pCanvas.height - 2);
      pc.fillText('30fps', 4, pCanvas.height - (30 / maxFps) * pCanvas.height - 2);
    }

    // Buttons
    document.getElementById('telem-close').onclick = () => overlay.remove();
    document.getElementById('telem-export').onclick = () => {
      const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gpt_telemetry_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
    };
  }

  // ── Keyboard shortcut: Ctrl+Shift+T ──
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      showDashboardOverlay();
    }
  });

  // ── Console command: typing "stats" ──
  // (exposed via window.stats)

  // ── Init ──
  initAutoTracking();

  // Public API
  const api = { track, flush, dashboard, exportData: exportData, optOut, optIn, clearData, showDashboard: showDashboardOverlay };
  window.telemetry = api;
  window.stats = () => { api.showDashboard(); };
  console.log('Telemetry loaded — Ctrl+Shift+T for dashboard, telemetry.dashboard() for console summary');
  return api;
})();
