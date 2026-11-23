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
    const hora = horaElegida;

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
    panel.appendChild(el('p', '', 'Tu pedido quedó apartado para las ' + formatHora12(data.hora_para) + '. Guarda estos números:'));
    data.apartados.forEach((a) => panel.appendChild(el('div', 'num', 'Apartado #' + a.numero_apartado)));
    data.apartados.forEach((a) => panel.appendChild(el('p', 'resumen', '#' + a.numero_apartado + ': ' + a.texto_pedido)));
    const otro = el('button', 'btn', 'Hacer otro pedido');
    otro.addEventListener('click', () => location.reload());
    panel.appendChild(otro);
    pagina.appendChild(panel);
  }

  /* ---------- Selector de hora (reloj) ---------- */

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const dial = document.getElementById('reloj-dial');
  const panelReloj = document.getElementById('reloj-panel');
  const btnHora = document.getElementById('hora-btn');
  const relojH = document.getElementById('reloj-h');
  const relojM = document.getElementById('reloj-m');
  const btnAm = document.getElementById('reloj-am');
  const btnPm = document.getElementById('reloj-pm');
  const ayuda = document.getElementById('reloj-ayuda');

  let horaElegida = ''; // "HH:MM" en 24 h, lo que recibe el backend
  const reloj = { h: 12, m: 0, ampm: 'PM', modo: 'h' };

  const pad2 = (n) => String(n).padStart(2, '0');

  function svgEl(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k]));
    return e;
  }

  function posicion(grados, radio) {
    const rad = (grados * Math.PI) / 180;
    return { x: 130 + radio * Math.sin(rad), y: 130 - radio * Math.cos(rad) };
  }

  function dibujarReloj() {
    dial.innerHTML = '';
    dial.appendChild(svgEl('circle', { cx: 130, cy: 130, r: 124, fill: '#fbefdc' }));

    const enHoras = reloj.modo === 'h';
    const gradosSel = enHoras ? reloj.h * 30 : reloj.m * 6;
    const fin = posicion(gradosSel, 92);
    dial.appendChild(svgEl('line', { x1: 130, y1: 130, x2: fin.x, y2: fin.y, stroke: '#e8590c', 'stroke-width': 3 }));
    dial.appendChild(svgEl('circle', { cx: 130, cy: 130, r: 5, fill: '#e8590c' }));
    dial.appendChild(svgEl('circle', { cx: fin.x, cy: fin.y, r: 21, fill: '#e8590c' }));

    for (let i = 1; i <= 12; i++) {
      const valor = enHoras ? i : (i * 5) % 60;
      const p = posicion(i * 30, 92);
      const elegido = enHoras ? valor === reloj.h : valor === reloj.m;
      const t = svgEl('text', {
        x: p.x, y: p.y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': 17, 'font-weight': 700, fill: elegido ? '#fff' : '#2b2118',
        'pointer-events': 'none',
      });
      t.textContent = enHoras ? String(valor) : pad2(valor);
      dial.appendChild(t);
    }

    relojH.textContent = String(reloj.h);
    relojM.textContent = pad2(reloj.m);
    relojH.classList.toggle('activo', enHoras);
    relojM.classList.toggle('activo', !enHoras);
    btnAm.classList.toggle('activo', reloj.ampm === 'AM');
    btnPm.classList.toggle('activo', reloj.ampm === 'PM');
    ayuda.textContent = enHoras ? 'Toca la hora en el reloj' : 'Ahora toca los minutos';
  }

  function valorDesdePuntero(ev) {
    const r = dial.getBoundingClientRect();
    const dx = ev.clientX - (r.left + r.width / 2);
    const dy = ev.clientY - (r.top + r.height / 2);
    let grados = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (grados < 0) grados += 360;
    const paso = Math.round(grados / 30) % 12; // 0..11
    if (reloj.modo === 'h') reloj.h = paso === 0 ? 12 : paso;
    else reloj.m = paso * 5;
    dibujarReloj();
  }

  let arrastrando = false;
  dial.addEventListener('pointerdown', (ev) => {
    arrastrando = true;
    try { dial.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura: igual funciona */ }
    valorDesdePuntero(ev);
  });
  dial.addEventListener('pointermove', (ev) => { if (arrastrando) valorDesdePuntero(ev); });
  dial.addEventListener('pointerup', () => {
    if (!arrastrando) return;
    arrastrando = false;
    if (reloj.modo === 'h') { reloj.modo = 'm'; dibujarReloj(); } // pasa solo a los minutos
  });

  relojH.addEventListener('click', () => { reloj.modo = 'h'; dibujarReloj(); });
  relojM.addEventListener('click', () => { reloj.modo = 'm'; dibujarReloj(); });
  btnAm.addEventListener('click', () => { reloj.ampm = 'AM'; dibujarReloj(); });
  btnPm.addEventListener('click', () => { reloj.ampm = 'PM'; dibujarReloj(); });

  btnHora.addEventListener('click', () => {
    reloj.modo = 'h';
    panelReloj.hidden = false;
    dibujarReloj();
    panelReloj.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('reloj-cancelar').addEventListener('click', () => { panelReloj.hidden = true; });
  document.getElementById('reloj-ok').addEventListener('click', () => {
    const h24 = (reloj.h % 12) + (reloj.ampm === 'PM' ? 12 : 0);
    horaElegida = pad2(h24) + ':' + pad2(reloj.m);
    btnHora.textContent = '🕐 ' + formatHora12(horaElegida);
    btnHora.classList.add('elegida');
    panelReloj.hidden = true;
  });

  const socket = io();
  socket.on('menu:actualizado', cargarMenu);
  socket.on('agotado:nuevo', cargarMenu);
  setInterval(cargarMenu, 60000);

  renderChips();
  cargarMenu();
})();
