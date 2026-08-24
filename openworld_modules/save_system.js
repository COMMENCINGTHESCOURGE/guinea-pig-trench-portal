// Ported from NOVA_HORIZON_3D
function saveGame() {
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

function loadGame() {
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
  
  // Move camera near outpost
  cam.position.set(outpostG.position.x + 5, getH(outpostG.position.x+5, outpostG.position.z+5)+2.5, outpostG.position.z + 5);
  
  notify('GAME LOADED — Day ' + state.gameDay);
  console.log('LOADED:', state.player.credits + 'cr');
}

