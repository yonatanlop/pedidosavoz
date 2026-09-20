(function () {
  const grid = document.getElementById('grid');
  const emptyMsg = document.getElementById('empty');
  const statusEl = document.getElementById('conn-status');
  const relojEl = document.getElementById('reloj');

  const pedidos = new Map();

  function formatHora(horaStr) {
    return horaStr ? horaStr.slice(0, 5) : '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function updateEmptyState() {
    emptyMsg.hidden = pedidos.size > 0;
  }

  function tituloTurno(turno) {
    return turno === 'almuerzo' ? 'Almuerzo' : 'Desayuno';
  }

  function renderPedido(pedido) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = pedido.id;
    card.innerHTML = `
      <div class="card-header">
        <span class="numero">${tituloTurno(pedido.turno)} #${pedido.numero_turno}</span>
        <span class="hora">${formatHora(pedido.hora_creacion)}</span>
      </div>
      <div class="card-mesera">${escapeHtml(pedido.mesera.nombre)}</div>
      <p class="texto">${escapeHtml(pedido.texto_pedido)}</p>
      <button class="btn-listo" type="button">Pedido #${pedido.numero_turno} listo &#10003;</button>
    `;
    card.querySelector('.btn-listo').addEventListener('click', () => marcarListo(pedido.id, card));
    return card;
  }

  function addPedido(pedido) {
    if (pedidos.has(pedido.id)) return;
    pedidos.set(pedido.id, pedido);
    grid.appendChild(renderPedido(pedido));
    updateEmptyState();
  }

  function removePedido(id) {
    if (!pedidos.has(id)) return;
    pedidos.delete(id);
    const card = grid.querySelector(`[data-id="${id}"]`);
    if (card) card.remove();
    updateEmptyState();
  }

  async function marcarListo(id, card) {
    const btn = card.querySelector('.btn-listo');
    btn.disabled = true;
    try {
      const res = await fetch(`/api/pedidos/${id}/listo`, { method: 'PATCH' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      removePedido(id);
    } catch (err) {
      console.error('Error marcando pedido como listo:', err);
      btn.disabled = false;
      alert('No se pudo marcar el pedido como listo. Intenta de nuevo.');
    }
  }

  async function cargarPendientes() {
    try {
      const res = await fetch('/api/pedidos?estado=pendiente');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const lista = await res.json();
      lista.forEach(addPedido);
    } catch (err) {
      console.error('Error cargando pedidos pendientes:', err);
    } finally {
      updateEmptyState();
    }
  }

  function setStatus(connected) {
    statusEl.textContent = connected ? 'En vivo' : 'Sin conexion';
    statusEl.className = connected ? 'status ok' : 'status error';
  }

  function actualizarReloj() {
    relojEl.textContent = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  actualizarReloj();
  setInterval(actualizarReloj, 1000 * 15);

  const socket = io();
  socket.on('connect', () => setStatus(true));
  socket.on('disconnect', () => setStatus(false));
  socket.on('connect_error', () => setStatus(false));
  socket.on('pedido:nuevo', addPedido);
  socket.on('pedido:listo', ({ id }) => removePedido(id));

  cargarPendientes();
})();
