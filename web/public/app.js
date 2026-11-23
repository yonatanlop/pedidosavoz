(function () {
  const grid = document.getElementById('grid');
  const listaApartados = document.getElementById('apartados');
  const emptyMsg = document.getElementById('empty');
  const emptyApartados = document.getElementById('empty-apartados');
  const statusEl = document.getElementById('conn-status');
  const relojEl = document.getElementById('reloj');
  const contadorEl = document.getElementById('contador');
  const contadorApartadosEl = document.getElementById('contador-apartados');
  const alertaEl = document.getElementById('alerta-apartados');
  const btnSonido = document.getElementById('btn-sonido');

  // Cada cuanto se le recuerda a cocina que hay apartados sin atender.
  const RECORDATORIO_MS = 10 * 60 * 1000;
  // Minutos antes de la hora del apartado en que la tarjeta pasa a "pronto".
  const AVISO_PRONTO_MIN = 15;

  const pedidos = new Map(); // pendientes normales
  const apartados = new Map(); // apartados pendientes

  let audioCtx = null;
  let sonidoActivo = false;

  function formatHora(horaStr) {
    return horaStr ? horaStr.slice(0, 5) : '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function tituloTurno(turno) {
    return turno === 'almuerzo' ? 'Almuerzo' : 'Desayuno';
  }

  /* ---------- Sonido y voz ---------- */

  function pitido(veces) {
    if (!audioCtx) return;
    for (let i = 0; i < veces; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = audioCtx.currentTime + i * 0.45;
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    }
  }

  function decir(texto) {
    if (!sonidoActivo || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-CO';
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }

  btnSonido.addEventListener('click', () => {
    // Los navegadores solo permiten audio despues de una interaccion del usuario.
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    sonidoActivo = true;
    btnSonido.textContent = '🔔 Avisos activados';
    btnSonido.classList.add('activo');
    pitido(1);
  });

  /* ---------- Apartados: estado segun la hora ---------- */

  function minutosHasta(horaPara) {
    if (!horaPara) return null;
    const [h, m] = horaPara.split(':').map(Number);
    const ahora = new Date();
    const objetivo = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), h, m, 0);
    return Math.round((objetivo - ahora) / 60000);
  }

  function textoRestante(min) {
    if (min === null) return 'Sin hora';
    if (min < 0) return `Hace ${-min} min`;
    if (min === 0) return 'Es ahora';
    if (min < 60) return `Faltan ${min} min`;
    return `Faltan ${Math.floor(min / 60)} h ${min % 60} min`;
  }

  function estadoApartado(min) {
    if (min === null) return '';
    if (min < 0) return 'vencido';
    if (min <= AVISO_PRONTO_MIN) return 'pronto';
    return '';
  }

  function refrescarApartado(card, pedido) {
    const min = minutosHasta(pedido.hora_para);
    card.classList.remove('vencido', 'pronto');
    const estado = estadoApartado(min);
    if (estado) card.classList.add(estado);
    const el = card.querySelector('.restante');
    if (el) el.textContent = textoRestante(min);
  }

  function refrescarTodosApartados() {
    apartados.forEach((pedido, id) => {
      const card = listaApartados.querySelector(`[data-id="${id}"]`);
      if (card) refrescarApartado(card, pedido);
    });
  }

  /* ---------- Render ---------- */

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

  function renderApartado(pedido) {
    const card = document.createElement('article');
    card.className = 'card card-apartado';
    card.dataset.id = pedido.id;
    const cliente = pedido.cliente_nombre
      ? `<div class="cliente">${escapeHtml(pedido.cliente_nombre)} · ${escapeHtml(pedido.cliente_celular || '')}</div>`
      : '';
    const origen = pedido.origen === 'online' ? '<span class="etiqueta">Online</span>' : '';
    card.innerHTML = `
      <div class="card-header">
        <span class="numero">Apartado #${pedido.numero_apartado}</span>
        ${origen}
      </div>
      <div class="para-hora">
        <span class="hora-grande">${pedido.hora_para ? formatHora(pedido.hora_para) : '--:--'}</span>
        <span class="restante"></span>
      </div>
      ${cliente}
      <p class="texto">${escapeHtml(pedido.texto_pedido)}</p>
      <button class="btn-listo" type="button">Apartado #${pedido.numero_apartado} listo &#10003;</button>
    `;
    card.querySelector('.btn-listo').addEventListener('click', () => marcarListo(pedido.id, card));
    refrescarApartado(card, pedido);
    return card;
  }

  function actualizarContadores() {
    contadorEl.textContent = pedidos.size;
    contadorApartadosEl.textContent = apartados.size;
    emptyMsg.hidden = pedidos.size > 0;
    emptyApartados.hidden = apartados.size > 0;
    if (apartados.size === 0) ocultarAlerta();
  }

  function ordenarApartados() {
    // Primero los que son para mas pronto; los que no tienen hora, al final.
    const cards = [...listaApartados.children];
    cards.sort((a, b) => {
      const pa = apartados.get(Number(a.dataset.id));
      const pb = apartados.get(Number(b.dataset.id));
      const ha = pa && pa.hora_para ? pa.hora_para : '99:99';
      const hb = pb && pb.hora_para ? pb.hora_para : '99:99';
      return ha.localeCompare(hb) || pa.id - pb.id;
    });
    cards.forEach((c) => listaApartados.appendChild(c));
  }

  function addPedido(pedido, esNuevo) {
    if (pedido.apartado) {
      if (apartados.has(pedido.id) || pedido.estado === 'listo') return;
      apartados.set(pedido.id, pedido);
      listaApartados.appendChild(renderApartado(pedido));
      ordenarApartados();
      if (esNuevo) {
        pitido(2);
        decir(`Nuevo apartado número ${pedido.numero_apartado}`);
      }
    } else {
      if (pedidos.has(pedido.id) || pedido.estado === 'listo') return;
      pedidos.set(pedido.id, pedido);
      grid.appendChild(renderPedido(pedido));
      if (esNuevo) pitido(1);
    }
    actualizarContadores();
  }

  function removePedido(id) {
    const mapa = pedidos.has(id) ? pedidos : apartados.has(id) ? apartados : null;
    if (!mapa) return;
    mapa.delete(id);
    const contenedor = mapa === pedidos ? grid : listaApartados;
    const card = contenedor.querySelector(`[data-id="${id}"]`);
    if (card) card.remove();
    actualizarContadores();
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
      const ids = new Set(lista.map((p) => p.id));
      // Si se reconecta, quita lo que ya se atendio mientras no habia conexion.
      [...pedidos.keys(), ...apartados.keys()].forEach((id) => {
        if (!ids.has(id)) removePedido(id);
      });
      lista.forEach((p) => addPedido(p, false));
    } catch (err) {
      console.error('Error cargando pedidos pendientes:', err);
    } finally {
      actualizarContadores();
    }
  }

  /* ---------- Recordatorio de apartados sin atender ---------- */

  function ocultarAlerta() {
    alertaEl.hidden = true;
  }

  function recordarApartados() {
    if (apartados.size === 0) return;
    const n = apartados.size;
    const vencidos = [...apartados.values()].filter((p) => estadoApartado(minutosHasta(p.hora_para)) === 'vencido').length;
    alertaEl.textContent =
      `⚠ Hay ${n} apartado${n === 1 ? '' : 's'} sin atender` +
      (vencidos ? ` (${vencidos} ya pasó de la hora)` : '');
    alertaEl.hidden = false;
    pitido(3);
    decir(`Atención, hay ${n} apartado${n === 1 ? '' : 's'} sin atender`);
    alertaEl.classList.add('parpadeo');
    setTimeout(() => alertaEl.classList.remove('parpadeo'), 30000);
  }

  setInterval(recordarApartados, RECORDATORIO_MS);
  setInterval(refrescarTodosApartados, 30 * 1000);

  /* ---------- Conexion ---------- */

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
  socket.on('connect', () => {
    setStatus(true);
    cargarPendientes();
  });
  socket.on('disconnect', () => setStatus(false));
  socket.on('connect_error', () => setStatus(false));
  socket.on('pedido:nuevo', (p) => addPedido(p, true));
  socket.on('pedido:listo', ({ id }) => removePedido(id));
})();
