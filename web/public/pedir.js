(function () {
  const MAX_ALMUERZOS = 3; // el servidor aplica el limite real por IP y por dia
  const EMOJI = { sopa: '🍲', arroz: '🍚', proteina: '🍖', grano: '🫘', ensalada: '🥗', acompanante: '🍌', bebida: '🥤' };
  const ORDEN_CATEGORIAS = ['sopa', 'arroz', 'proteina', 'grano', 'ensalada', 'acompanante', 'bebida'];
  const TITULOS = { proteina: 'Proteína', acompanante: 'Acompañante', grano: 'Grano / menestra' };

  const menuEl = document.getElementById('menu');
  const menuVacio = document.getElementById('menu-vacio');
  const chipsEl = document.getElementById('chips');
  const resumenEl = document.getElementById('resumen');
  const errorEl = document.getElementById('error');
  const btnPedir = document.getElementById('btn-pedir');
  const infoBarra = document.getElementById('info-barra');

  let items = [];
  let almuerzos = [new Set()]; // cada almuerzo = ids elegidos
  let actual = 0;

  function el(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function tituloCategoria(c) {
    return TITULOS[c] || c;
  }

  function mostrarError(msg) {
    errorEl.textContent = msg || '';
    errorEl.hidden = !msg;
  }

  function nombresDe(set) {
    return [...set].map((id) => (items.find((i) => i.id === id) || {}).nombre).filter(Boolean);
  }

  /* ---------- Menu ---------- */

  function renderMenu() {
    menuEl.innerHTML = '';
    menuVacio.hidden = items.length > 0;

    // Si algo se agoto mientras la persona lo tenia elegido, se quita.
    items.filter((i) => i.agotado).forEach((i) => almuerzos.forEach((s) => s.delete(i.id)));

    const grupos = new Map();
    items.forEach((i) => {
      if (!grupos.has(i.categoria)) grupos.set(i.categoria, []);
      grupos.get(i.categoria).push(i);
    });
    const categorias = [...grupos.keys()].sort((a, b) => {
      const ia = ORDEN_CATEGORIAS.indexOf(a); const ib = ORDEN_CATEGORIAS.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    categorias.forEach((cat) => {
      menuEl.appendChild(el('h3', 'categoria', tituloCategoria(cat)));
      const cont = el('div', 'opciones');
      grupos.get(cat).forEach((item) => cont.appendChild(renderOpcion(item)));
      menuEl.appendChild(cont);
    });
    renderChips();
  }

  function renderOpcion(item) {
    const btn = el('button', 'opcion');
    btn.type = 'button';
    btn.dataset.id = item.id;
    btn.disabled = item.agotado;
    if (almuerzos[actual].has(item.id)) btn.classList.add('sel');

    if (item.imagen_url) {
      const img = el('img', 'foto');
      img.src = item.imagen_url;
      img.alt = item.nombre;
      img.loading = 'lazy';
      btn.appendChild(img);
    } else {
      btn.appendChild(el('div', 'foto', EMOJI[item.categoria] || '🍽️'));
    }
    btn.appendChild(el('span', 'nombre', item.nombre));
    btn.appendChild(el('span', 'check', '✓'));
    if (item.agotado) btn.appendChild(el('span', 'agotado', 'AGOTADO'));

    btn.addEventListener('click', () => {
      const set = almuerzos[actual];
      if (set.has(item.id)) set.delete(item.id); else set.add(item.id);
      btn.classList.toggle('sel', set.has(item.id));
      renderChips();
    });
    return btn;
  }

  function refrescarSeleccion() {
    menuEl.querySelectorAll('.opcion').forEach((b) => {
      b.classList.toggle('sel', almuerzos[actual].has(Number(b.dataset.id)));
    });
  }

  /* ---------- Almuerzos (chips) ---------- */

  function renderChips() {
    chipsEl.innerHTML = '';
    almuerzos.forEach((set, idx) => {
      const detalle = set.size ? ` · ${set.size} plato${set.size === 1 ? '' : 's'}` : '';
      const chip = el('button', 'chip' + (idx === actual ? ' activo' : ''), `Almuerzo ${idx + 1}${detalle}`);
      chip.type = 'button';
      chip.addEventListener('click', () => { actual = idx; renderChips(); refrescarSeleccion(); });
      if (almuerzos.length > 1) {
        const x = el('span', 'x', '✕');
        x.title = 'Quitar este almuerzo';
        x.addEventListener('click', (ev) => {
          ev.stopPropagation();
          almuerzos.splice(idx, 1);
          actual = Math.min(actual, almuerzos.length - 1);
          renderChips();
          refrescarSeleccion();
        });
        chip.appendChild(x);
      }
      chipsEl.appendChild(chip);
    });

    if (almuerzos.length < MAX_ALMUERZOS) {
      const nuevo = el('button', 'chip nuevo', '+ Agregar otro almuerzo');
      nuevo.type = 'button';
      nuevo.addEventListener('click', () => {
        almuerzos.push(new Set());
        actual = almuerzos.length - 1;
        renderChips();
        refrescarSeleccion();
      });
      chipsEl.appendChild(nuevo);
    }

    const nombres = nombresDe(almuerzos[actual]);
    resumenEl.textContent = nombres.length
      ? `Almuerzo ${actual + 1}: ${nombres.join(', ')}`
      : `Elige lo que va en el almuerzo ${actual + 1}.`;

    const total = almuerzos.filter((s) => s.size > 0).length;
    infoBarra.textContent = total ? `${total} almuerzo${total === 1 ? '' : 's'} listo${total === 1 ? '' : 's'} para pedir` : 'Aún no has elegido nada';
  }

  async function cargarMenu() {
    try {
      const res = await fetch('/api/menu');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      items = await res.json();
      renderMenu();
    } catch (err) {
      mostrarError('No se pudo cargar el menú. Revisa tu conexión.');
    }
  }

  /* ---------- Pedir ---------- */

  btnPedir.addEventListener('click', async () => {
    mostrarError('');
    const llenos = almuerzos.filter((s) => s.size > 0);
    const nombre = document.getElementById('nombre').value.trim();
    const celular = document.getElementById('celular').value.trim();
    const hora = document.getElementById('hora').value;

    if (!llenos.length) return mostrarError('Elige al menos un plato para tu almuerzo.');
    if (nombre.length < 2) return mostrarError('Escribe tu nombre.');
    if (celular.replace(/\D/g, '').length < 7) return mostrarError('Escribe un número de celular válido.');
    if (!hora) return mostrarError('Indica a qué hora lo necesitas.');

    btnPedir.disabled = true;
    btnPedir.textContent = 'Enviando...';
    try {
      const res = await fetch('/api/menu/pedido-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          celular,
          hora_para: hora,
          almuerzos: llenos.map((s) => ({ items: [...s] })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        mostrarError(data.error || 'No se pudo enviar el pedido.');
        if (res.status === 400) cargarMenu();
        return;
      }
      mostrarGracias(data, nombre);
    } catch (err) {
      mostrarError('No se pudo enviar el pedido. Revisa tu conexión e intenta de nuevo.');
    } finally {
      btnPedir.disabled = false;
      btnPedir.textContent = 'Pedir';
    }
  });

  function mostrarGracias(data, nombre) {
    document.getElementById('barra').remove();
    const pagina = document.getElementById('pagina');
    pagina.innerHTML = '';
    const panel = el('section', 'panel gracias');
    panel.appendChild(el('h1', '', '¡Listo, ' + nombre + '! ✅'));
    panel.appendChild(el('p', '', 'Tu pedido quedó apartado para las ' + data.hora_para + '. Guarda estos números:'));
    data.apartados.forEach((a) => panel.appendChild(el('div', 'num', 'Apartado #' + a.numero_apartado)));
    data.apartados.forEach((a) => panel.appendChild(el('p', 'resumen', '#' + a.numero_apartado + ': ' + a.texto_pedido)));
    const otro = el('button', 'btn', 'Hacer otro pedido');
    otro.addEventListener('click', () => location.reload());
    panel.appendChild(otro);
    pagina.appendChild(panel);
  }

  const socket = io();
  socket.on('menu:actualizado', cargarMenu);
  socket.on('agotado:nuevo', cargarMenu);
  setInterval(cargarMenu, 60000);

  renderChips();
  cargarMenu();
})();
