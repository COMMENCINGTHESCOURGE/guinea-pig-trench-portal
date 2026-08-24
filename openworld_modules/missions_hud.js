// Ported from NOVA_HORIZON_3D
function updateMissionHUD() {
  // Update the HUD objective panel with active mission info
  const oPrim = document.getElementById('oPrim');
  if (!oPrim) return;

  if (activeMissions.length > 0) {
    const m = activeMissions[0];
    const stateLabel = m.state === 'travel' ? '◈ ' + Math.floor(cam.position.distanceTo(m.objectivePos)/1000*10)/10 + ' km' : '▶ RETURN TO OUTPOST';
    oPrim.innerHTML = `<span>◆</span><span>${m.title}</span><span class="d" id="oMissionDist">${stateLabel}</span>`;
  } else {
    if (!player.hasSignal) {
      oPrim.innerHTML = '<span>◈</span><span>Locate Outpost Signal</span><span class="d" id="oDist">' + (outpostG.position.distanceTo(cam.position)/1000).toFixed(1) + ' km</span>';
    } else {
      oPrim.innerHTML = '<span>◈</span><span>Visit Outpost Hub</span><span class="d">COMPLETE</span>';
    }
  }
}

