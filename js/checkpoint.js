// ============================================================
// CHECKPOINT.JS — Atomic save/resume for all portal games
// Ported from erdos-straus/sieve/io_safety.py
// Same pattern: atomic write, versioned state, crash-safe resume
// ============================================================

const Checkpoint = (() => {
  const STORAGE_PREFIX = 'gpt_checkpoint_';
  const VERSION = 1;

  /**
   * Save game state atomically.
   * Writes to a temp key first, then swaps — mirrors os.replace() from io_safety.py
   * @param {string} gameId - Unique game identifier
   * @param {Object} state - Serializable game state
   */
  function save(gameId, state) {
    const key = STORAGE_PREFIX + gameId;
    const tempKey = key + '_tmp';
    const payload = {
      version: VERSION,
      gameId,
      timestamp: Date.now(),
      iso: new Date().toISOString(),
      state
    };

    try {
      // Write to temp key first (atomic step 1)
      localStorage.setItem(tempKey, JSON.stringify(payload));
      // Swap to real key (atomic step 2 — mirrors os.replace())
      localStorage.setItem(key, localStorage.getItem(tempKey));
      // Clean up temp
      localStorage.removeItem(tempKey);
      return true;
    } catch (e) {
      // Storage full or unavailable — clean up temp, don't corrupt real key
      try { localStorage.removeItem(tempKey); } catch (_) {}
      console.warn(`Checkpoint save failed for ${gameId}:`, e.message);
      return false;
    }
  }

  /**
   * Load game state. Returns null if no checkpoint exists.
   * Mirrors load_checkpoint_csv() from io_safety.py
   * @param {string} gameId - Unique game identifier
   * @returns {Object|null} - Saved state or null
   */
  function load(gameId) {
    const key = STORAGE_PREFIX + gameId;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const payload = JSON.parse(raw);

      // Version check — if format changed, discard old saves
      if (payload.version !== VERSION) {
        console.warn(`Checkpoint version mismatch for ${gameId}: expected ${VERSION}, got ${payload.version}`);
        return null;
      }

      return payload.state;
    } catch (e) {
      console.warn(`Checkpoint load failed for ${gameId}:`, e.message);
      return null;
    }
  }

  /**
   * Check if a checkpoint exists for a game
   * @param {string} gameId
   * @returns {boolean}
   */
  function exists(gameId) {
    return localStorage.getItem(STORAGE_PREFIX + gameId) !== null;
  }

  /**
   * Get metadata about a checkpoint without loading full state
   * @param {string} gameId
   * @returns {Object|null} - {timestamp, iso, gameId} or null
   */
  function meta(gameId) {
    const key = STORAGE_PREFIX + gameId;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      return {
        gameId: payload.gameId,
        timestamp: payload.timestamp,
        iso: payload.iso,
        age: Date.now() - payload.timestamp
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Delete a checkpoint
   * @param {string} gameId
   */
  function clear(gameId) {
    localStorage.removeItem(STORAGE_PREFIX + gameId);
    localStorage.removeItem(STORAGE_PREFIX + gameId + '_tmp');
  }

  /**
   * List all checkpointed games
   * @returns {Array<Object>} - [{gameId, timestamp, iso, age}]
   */
  function listAll() {
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STORAGE_PREFIX) && !key.endsWith('_tmp')) {
        const gameId = key.slice(STORAGE_PREFIX.length);
        const m = meta(gameId);
        if (m) results.push(m);
      }
    }
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clean up stale checkpoints older than maxAge (ms)
   * Mirrors the sieve's stale-timestamp reclaim pattern
   * @param {number} maxAgeMs - Max age in milliseconds (default: 7 days)
   * @returns {number} - Number of checkpoints cleaned
   */
  function cleanup(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    let cleaned = 0;
    const all = listAll();
    for (const m of all) {
      if (m.age > maxAgeMs) {
        clear(m.gameId);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Get total storage used by checkpoints (bytes)
   * @returns {number}
   */
  function storageUsed() {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STORAGE_PREFIX)) {
        bytes += localStorage.getItem(key).length * 2; // UTF-16
      }
    }
    return bytes;
  }

  // Public API — matches io_safety.py function names where possible
  return {
    save,           // atomic_write_csv → save
    load,           // load_checkpoint_csv → load
    exists,         // file existence check
    meta,           // metadata without full load
    clear,          // delete checkpoint
    listAll,        // enumerate all saves
    cleanup,        // stale timestamp cleanup (sieve pattern)
    storageUsed     // storage monitoring
  };
})();

// Export for both module and script contexts
if (typeof module !== 'undefined') module.exports = Checkpoint;
