// Convierte "13:05" o "13:05:30.123" (24 h, como lo guarda el backend) a "1:05 PM".
window.formatHora12 = function (hora) {
  if (!hora) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(hora);
  if (!m) return hora;
  const h24 = Number(m[1]);
  const sufijo = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return h12 + ':' + m[2] + ' ' + sufijo;
};
