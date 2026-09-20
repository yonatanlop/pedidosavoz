require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const createApp = require('./app');
const registrarSockets = require('./sockets');

const PORT = process.env.PORT || 3000;

const server = http.createServer();

// io se crea sin servidor todavia: necesitamos poder inyectarlo en las rutas
// de Express antes de que Express quede registrado como listener de 'request'.
// Si Express se registrara primero y luego llamaramos `new Server(server)`,
// socket.io instalaria su propio listener de 'request' en paralelo al de
// Express (en vez de delegarle las rutas que no son suyas), y ambos
// intentarian responder la misma petición a /socket.io/.
const io = new Server({
  cors: { origin: process.env.CORS_ORIGIN || '*' },
});

const app = createApp(io);
server.on('request', app);

// Al hacer attach, socket.io toma los listeners de 'request' ya registrados
// (Express) como fallback: las rutas /socket.io/ las maneja el, el resto se
// las delega a Express.
io.attach(server);

registrarSockets(io);

server.listen(PORT, () => {
  console.log(`PedidosVoz backend escuchando en el puerto ${PORT}`);
});
