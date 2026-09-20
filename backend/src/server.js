require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const createApp = require('./app');
const registrarSockets = require('./sockets');

const PORT = process.env.PORT || 3000;

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*' },
});

const app = createApp(io);
server.on('request', app);

registrarSockets(io);

server.listen(PORT, () => {
  console.log(`PedidosVoz backend escuchando en el puerto ${PORT}`);
});
