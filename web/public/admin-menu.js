(function () {
  const EMOJI = { sopa: '🍲', arroz: '🍚', proteina: '🍖', grano: '🫘', ensalada: '🥗', acompanante: '🍌', bebida: '🥤' };
  const loginEl = document.getElementById('login');
  const contenidoEl = document.getElementById('contenido');
  const claveEl = document.getElementById('clave');
  const errorLogin = document.getElementById('error-login');
  const listaEl = document.getElementById('lista');
  const mensajeEl = document.getElementById('mensaje');
  const resumenCat = document.getElementById('resumen-cat');

  let clave = '';
  try { clave = sessionStorage.getItem('adminKey') || ''; } catch (e) { /* sin storage */ }

  function el(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function aviso(msg, ok) {
    mensajeEl.textContent = msg || '';
    mensajeEl.className = 'mensaje ' + (ok ? 'ok' : 'error');
    mensajeEl.hidden = !msg;
  }

  async function api(metodo, ruta, cuerpo) {
    const res = await fetch('/api/menu' + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'x-admin-key': clave },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (res.status === 403) throw new Error('403');
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Error ' + res.status);
    }
    return res.status === 204 ? null : res.json();
  }

  // Reduce la foto a max 800 px y la convierte a JPEG antes de subirla.
  function fotoABase64(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const escala = Math.min(1, 800 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = url;
    });
  }

  // Cierra la sesion: borra la clave de la memoria y del navegador y vuelve al login.
  function cerrarSesion(mensaje, tipo) {
    try { sessionStorage.removeItem('adminKey'); } catch (e) { /* sin storage */ }
    contenidoEl.hidden = true;
    loginEl.hidden = false;
    errorLogin.textContent = mensaje || '';
    errorLogin.className = 'mensaje ' + (tipo || 'error');
    errorLogin.hidden = !mensaje;
    claveEl.value = '';
    clave = '';
    listaEl.innerHTML = '';
    aviso('');
  }

  // La clave guardada ya no sirve (cambiaron la ADMIN_KEY): vuelve a pedirla.
  function pedirClaveDeNuevo() {
    cerrarSesion(clave ? 'La clave es incorrecta o cambió. Escríbela de nuevo.' : '');
  }

  /* ---------- Inactividad ---------- */

  const INACTIVIDAD_MS = 5 * 60 * 1000;
  let ultimaActividad = Date.now();

  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach((ev) => {
    document.addEventListener(ev, () => { ultimaActividad = Date.now(); }, { passive: true });
  });

  // Se compara con la hora real (no con un temporizador unico) para que tambien
  // cierre si el computador estuvo suspendido o la pestana en segundo plano.
  setInterval(() => {
    if (!contenidoEl.hidden && Date.now() - ultimaActividad >= INACTIVIDAD_MS) {
      cerrarSesion('Sesión cerrada por inactividad. Escribe la clave para continuar.', 'info');
    }
  }, 10 * 1000);

  document.getElementById('btn-salir').addEventListener('click', () => cerrarSesion('Sesión cerrada.', 'info'));

  async function cargar() {
    try {
      const items = await api('GET', '?todos=1');
      loginEl.hidden = true;
      contenidoEl.hidden = false;
      render(items);
    } catch (err) {
      if (err.message === '403') pedirClaveDeNuevo();
      else aviso(err.message);
    }
  }

  function render(items) {
    listaEl.innerHTML = '';
    resumenCat.textContent = `(${items.filter((i) => i.activo).length} en el menú de hoy de ${items.length})`;
    if (!items.length) listaEl.appendChild(el('p', 'resumen', 'Aún no hay platos. Agrega el primero arriba.'));

    items.forEach((item) => {
      const fila = el('div', 'item-admin');
      if (item.imagen_url) {
        const img = el('img');
        img.src = item.imagen_url;
        img.alt = item.nombre;
        fila.appendChild(img);
      } else {
        fila.appendChild(el('div', 'sin-foto', EMOJI[item.categoria] || '🍽️'));
      }

      const datos = el('div', 'datos');
      const nombre = el('strong', '', item.nombre);
      datos.appendChild(nombre);
      datos.appendChild(el('span', 'tag ' + (item.activo ? 'verde' : ''), item.activo ? 'En el menú de hoy' : 'Fuera del menú'));
      if (item.agotado) datos.appendChild(el('span', 'tag rojo', 'Agotado'));
      datos.appendChild(el('br'));
      datos.appendChild(el('small', '', item.categoria));
      fila.appendChild(datos);

      const acc = el('div', 'acciones');
      acc.appendChild(boton(item.activo ? 'Quitar de hoy' : 'Poner en hoy', 'sec', () => accion(() => api('PUT', '/items/' + item.id, { activo: !item.activo }))));
      acc.appendChild(boton(item.agotado ? 'Hay de nuevo' : 'Se agotó', 'sec', () => accion(() => api('POST', '/items/' + item.id + '/agotado', { agotado: !item.agotado }))));
      acc.appendChild(boton('Cambiar foto', 'sec', () => cambiarFoto(item)));
      acc.appendChild(boton('Renombrar', 'sec', () => renombrar(item)));
      acc.appendChild(boton('Borrar', 'peligro', () => {
        if (confirm('¿Borrar "' + item.nombre + '" del catálogo?')) accion(() => api('DELETE', '/items/' + item.id));
      }));
      fila.appendChild(acc);
      listaEl.appendChild(fila);
    });
  }

  function boton(texto, tipo, fn) {
    const b = el('button', 'btn chico ' + tipo, texto);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  async function accion(fn) {
    aviso('');
    try { await fn(); await cargar(); } catch (err) {
      if (err.message === '403') pedirClaveDeNuevo(); else aviso(err.message);
    }
  }

  function cambiarFoto(item) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = () => {
      if (!input.files[0]) return;
      accion(async () => {
        const b64 = await fotoABase64(input.files[0]);
        await api('PUT', '/items/' + item.id, { imagen_base64: b64, imagen_mime: 'image/jpeg' });
      });
    };
    input.click();
  }

  function renombrar(item) {
    const nuevo = prompt('Nuevo nombre', item.nombre);
    if (nuevo && nuevo.trim() && nuevo.trim() !== item.nombre) {
      accion(() => api('PUT', '/items/' + item.id, { nombre: nuevo.trim() }));
    }
  }

  document.getElementById('btn-agregar').addEventListener('click', async () => {
    const nombre = document.getElementById('n-nombre').value.trim();
    const categoria = document.getElementById('n-categoria').value;
    const foto = document.getElementById('n-foto').files[0];
    if (!nombre) return aviso('Escribe el nombre del plato');
    aviso('');
    try {
      const cuerpo = { nombre, categoria };
      if (foto) { cuerpo.imagen_base64 = await fotoABase64(foto); cuerpo.imagen_mime = 'image/jpeg'; }
      await api('POST', '/items', cuerpo);
      document.getElementById('n-nombre').value = '';
      document.getElementById('n-foto').value = '';
      aviso('Plato agregado ✔', true);
      await cargar();
    } catch (err) {
      if (err.message === '403') pedirClaveDeNuevo(); else aviso(err.message);
    }
  });

  document.getElementById('btn-entrar').addEventListener('click', () => {
    clave = claveEl.value;
    try { sessionStorage.setItem('adminKey', clave); } catch (e) { /* sin storage */ }
    cargar();
  });
  claveEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('btn-entrar').click(); });

  io().on('agotado:nuevo', () => { if (!contenidoEl.hidden) cargar(); });

  if (clave) cargar();
})();
