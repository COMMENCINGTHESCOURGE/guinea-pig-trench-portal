// ═════════════════════════════════════════════
// MISSIONS MODULE — ported from NOVA_HORIZON_3D
// Self-contained: owns its state, exposes tick() + interact hooks
// ═════════════════════════════════════════════

// ── state shim (NOVA globals → module state) ──
let gameDay = 1;
const completedMissionIds = new Set();
const activeMissions = [];
export const missionState = { gameDay, completedMissionIds, activeMissions };


// ── context injection (wired by host game) ──
let ctx = { nearOutpost:false };
export function initMissionContext(c){ ctx = c; }

// ── data ──
// Ported from NOVA_HORIZON_3D (trench_builder)
export const MISSION_MAP = {
  'ransom_run':  { char: 'Kael Vos',      giver: 'Kael Vos',          desc: 'Deliver goods to Grief Wastes and survive the ambush.',         reward: {credits:3000,rep:10,shield:20}, enemy: true },
  'false_flag':  { char: 'Aya Nox',       giver: 'Aya Nox',           desc: 'Swap real cargo on a parallel route before the pirates strike.', reward: {credits:4000,rep:15,energy:30},  enemy: true },
  'inside_man':  { char: 'Sera Qin',      giver: 'Sera Qin',          desc: 'Feed false info to identify the leak without triggering a raid.', reward: {credits:2500,rep:8,sync:3},     enemy: false },
  'debt_trap':   { char: 'Gorath Vehn',   giver: 'Gorath Vehn',       desc: 'Run flagged cargo to clear your debt — bribe, reroute, or fight.',  reward: {credits:5000,rep:20,hp:15},     enemy: true },
  'grey_market': { char: 'The Twins (Mir + Kor)', giver: 'The Twins (Mir + Kor)', desc: 'Source raw materials and protect the chemist from enforcers.',  reward: {credits:3500,rep:12,shield:25},  enemy: true },
};


// ── daily rotation ──
// Ported from NOVA_HORIZON_3D
export function getDailyMissions() {
  const day = window.gameDay || 1;
  const ids = Object.keys(MISSION_MAP);
  // Rotate based on day so different missions are available
  const offset = (day - 1) % ids.length;
  const rolled = [];
  for (let i = 0; i < Math.min(2, ids.length); i++) {
    const id = ids[(offset + i) % ids.length];
    if (!completedMissionIds.has(id) && !activeMissions.find(m => m.id === id)) {
      rolled.push(id);
    }
  }
  // Fill with any incomplete if rotation doesn't yield enough
  if (rolled.length < 2) {
    for (const id of ids) {
      if (!completedMissionIds.has(id) && !activeMissions.find(m => m.id === id) && !rolled.includes(id)) {
        rolled.push(id);
        if (rolled.length >= 2) break;
      }
    }
  }
  return rolled.map(id => ({
    id,
    title: (window.MISSIONS || window.B_ROLL_MISSIONS)?.find(m => m.id === id)?.title || MISSION_MAP[id]?.title || id.replace(/_/g,' ').toUpperCase(),
    ...MISSION_MAP[id],
  }));
}



// ── accept/complete lifecycle ──
export function acceptMission(id){
  const m = activeMissions.find(m=>m.id===id);
  if(!m && !completedMissionIds.has(id)){
    const def = MISSION_MAP[id];
    if(def) activeMissions.push({ id, ...def });
  }
}
export function completeMission(id){
  const idx = activeMissions.findIndex(m=>m.id===id);
  if(idx>=0){
    activeMissions.splice(idx,1);
    completedMissionIds.add(id);
    return MISSION_MAP[id]?.reward || {};
  }
  return null;
}

// ── board UI ──
// Ported from NOVA_HORIZON_3D
export function updateMissionBoard() {
  try{
    if (!ctx.nearOutpost) return;
    const og = ctx.outpostG;
    if (!og || typeof cam === 'undefined' || typeof missionBoardPromptActive === 'undefined') return;
    const dist = og.position.distanceTo(cam.position);
    if (dist > 15) { missionBoardPromptActive = false; return; }

    const available = getDailyMissions();
    if (available.length === 0 && activeMissions.length === 0) {
      missionBoardPromptActive = false;
      return;
    }

    missionBoardPromptActive = true;
  }catch(e){ /* safe no-op for openworld port */ }
}



// ── HUD ──
// Ported from NOVA_HORIZON_3D
export function updateMissionHUD() {
  try{
  let oPrim = document.getElementById('oPrim');
if (!oPrim) {
  oPrim = document.createElement('div');
  oPrim.id = 'oPrim';
  oPrim.style.cssText = 'position:absolute;top:40px;left:14px;color:#0fc;font-size:12px;text-shadow:0 0 4px rgba(0,255,255,0.5);pointer-events:none';
  document.body.appendChild(oPrim);
};
  if (!oPrim) return;

  if (activeMissions.length > 0) {
    const m = activeMissions[0];
    let stateLabel = '▶ RETURN TO OUTPOST';
    try{
      if(m.state === 'travel' && typeof cam !== 'undefined' && m.objectivePos) stateLabel = '◈ ' + Math.floor(cam.position.distanceTo(m.objectivePos)/1000*10)/10 + ' km';
    }catch(e){}
    oPrim.innerHTML = `<span>◆</span><span>${m.title||m.id}</span><span class="d" id="oMissionDist">${stateLabel}</span>`;
  } else {
    if (!ctx.nearOutpost) {
      let distStr = '—';
      try{ const og = ctx.outpostG; if(og && typeof cam !== 'undefined') distStr = (og.position.distanceTo(cam.position)/1000).toFixed(1) + ' km'; }catch(e){}
      oPrim.innerHTML = '<span>◈</span><span>Locate Outpost Signal</span><span class="d" id="oDist">' + distStr + '</span>';
    } else {
      oPrim.innerHTML = '<span>◈</span><span>Visit Outpost Hub</span><span class="d">COMPLETE</span>';
    }
  }
  }catch(e){ /* safe no-op */ }
}



// ── save/load ──
// Ported from NOVA_HORIZON_3D
export function saveGame() {
  const state = {
    player: {...player},
    gameDay: window.gameDay || 1,
    faction: window.selectedFactionIndex || 0,
    completedMissions: [...completedMissionIds],
    npcState: {...npcState},
    rocksHarvested: [...rocksHarvested],
    treesHarvested: [...treesHarvested],
    achievements: window._achievements || {},
    inventory: window._inventory || [],
    weaponUpgrades: window._weaponUpgrades || {},
    timestamp: Date.now()
  };
  localStorage.setItem('nova_horizon_save', JSON.stringify(state));
  notify('GAME SAVED');
  console.log('SAVED:', state.player.credits + 'cr, Day ' + state.gameDay);
}

export function loadGame() {
  const raw = localStorage.getItem('nova_horizon_save');
  if (!raw) { notify('NO SAVE FOUND'); return; }
  const state = JSON.parse(raw);
  
  // Restore player
  Object.assign(player, state.player);
  window.gameDay = state.gameDay;
  window.selectedFactionIndex = state.faction;
  completedMissionIds = new Set(state.completedMissions || []);
  Object.assign(npcState, state.npcState || {});
  rocksHarvested.clear(); (state.rocksHarvested||[]).forEach(i => rocksHarvested.add(i));
  treesHarvested.clear(); (state.treesHarvested||[]).forEach(i => treesHarvested.add(i));
  window._achievements = state.achievements || {};
  window._inventory = state.inventory || [];
  window._weaponUpgrades = state.weaponUpgrades || {};
  
  // Update visual state
  updateHotbar();
  updateHUD();
  checkObjs();
  
  // Move camera near outpost (via injected context — outpostG lives in host ctx)
  const ogL = ctx.outpostG;
  if (ogL && typeof cam !== 'undefined') {
    cam.position.set(ogL.position.x + 5, getH(ogL.position.x+5, ogL.position.z+5)+2.5, ogL.position.z + 5);
  }
  
  notify('GAME LOADED — Day ' + state.gameDay);
  console.log('LOADED:', state.player.credits + 'cr');
}


