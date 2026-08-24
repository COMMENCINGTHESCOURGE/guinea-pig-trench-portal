// Ported from NOVA_HORIZON_3D
function notify(txt) {
  const n = document.getElementById('notify');
  n.textContent = txt; n.classList.add('s');
  setTimeout(() => n.classList.remove('s'), 2500);
}

