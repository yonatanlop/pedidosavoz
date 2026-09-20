(function () {
  const grid = document.getElementById('grid');
  const emptyMsg = document.getElementById('empty');
  const statusEl = document.getElementById('conn-status');
  const fechaInput = document.getElementById('fecha');
  const btnHoy = document.getElementById('btn-hoy');

  function fechaHoy() {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset();
    const local = new Date(hoy.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 10);
  }

  function formatHora(horaStr) {
    return horaStr ? horaStr.slice(0, 5) : '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderPedido(pedido) {
    const card = document.createElement('article');
    card.className = 'card card-historial';
    card.dataset.id = pedido.id;
    card.innerHTML = `
      <div class="card-header">
        <span class="mesera">${escapeHtml(pedido.mesera.nombre)}</span>
        <span class="hora">${formatHora(pedido.hora_creacion)} → ${formatHora(pedido.listo_en ? pedido.listo_en.slice(11) : '')}</span>
      </div>
      <p class="texto">${escapeHtml(pedido.texto_pedido)}</p>
    `;
    return card;
  }

  async function cargarHistorial() {
    grid.innerHTML = '';
    const fecha = fechaInput.value;
    try {
      const res = await fetch(`/api/pedidos?estado=listo&fecha=${fecha}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const lista = await res.json();
      lista
        .slice()
        .reverse()
        .forEach((pedido) => grid.appendChild(renderPedido(pedido)));
      emptyMsg.hidden = lista.length > 0;
    } catch (err) {
      console.error('Error cargando historial:', err);
      emptyMsg.hidden = false;
      emptyMsg.textContent = 'No se pudo cargar el historial';
    }
  }

  function setStatus(connected) {
    statusEl.textContent = connected ? 'En vivo' : 'Sin conexion';
    statusEl.className = connected ? 'status ok' : 'status error';
  }

  fechaInput.value = fechaHoy();
  fechaInput.addEventListener('change', cargarHistorial);
  btnHoy.addEventListener('click', () => {
    fechaInput.value = fechaHoy();
    cargarHistorial();
  });

  const socket = io();
  socket.on('connect', () => setStatus(true));
  socket.on('disconnect', () => setStatus(false));
  socket.on('connect_error', () => setStatus(false));
  socket.on('pedido:listo', () => {
    if (fechaInput.value === fechaHoy()) cargarHistorial();
  });

  cargarHistorial();
})();
