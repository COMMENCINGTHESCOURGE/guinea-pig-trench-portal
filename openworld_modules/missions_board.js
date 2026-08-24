// Ported from NOVA_HORIZON_3D
function updateMissionBoard() {
  // Only prompt near outpost with signal
  if (!player.hasSignal) return;
  const dist = outpostG.position.distanceTo(cam.position);
  if (dist > 15) { missionBoardPromptActive = false; return; }

  const available = getDailyMissions();
  if (available.length === 0 && activeMissions.length === 0) {
    missionBoardPromptActive = false;
    return;
  }

  missionBoardPromptActive = true;
}

