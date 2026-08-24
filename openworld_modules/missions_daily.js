// Ported from NOVA_HORIZON_3D
function getDailyMissions() {
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

