// server.js
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"] }
});

// Servimos la carpeta public
app.use(express.static(path.join(__dirname, "public")));

const salas = new Map(); 
// Estructura: salas.set(idSala, { state: {puntos, nombres}, admin: socketId });

function genSalaId() {
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  return salas.has(id) ? genSalaId() : id;
}

io.on("connection", (socket) => {
  let salaActual = null;

  socket.on("createRoom", ({ customId }) => {
    let idSala;
    if (customId) {
      idSala = customId.toUpperCase();
      if (salas.has(idSala)) {
        socket.emit("roomError", "Ese ID de sala ya está en uso");
        return;
      }
    } else {
      idSala = genSalaId();
    }

    salas.set(idSala, {
      state: {
        puntos: { team1: 0, team2: 0 },
        nombres: { team1: "Equipo 1", team2: "Equipo 2" }
      },
      admin: socket.id
    });
    socket.join(idSala);
    salaActual = idSala;
    socket.emit("roomCreated", { idSala });
    socket.emit("state", salas.get(idSala).state);
  });

  socket.on("joinRoom", ({ idSala }) => {
    if (!salas.has(idSala)) {
      socket.emit("roomError", "Sala no encontrada");
      return;
    }
    socket.join(idSala);
    salaActual = idSala;
    socket.emit("state", salas.get(idSala).state);
  });

  socket.on("updateState", (state) => {
    if (!salaActual || !salas.has(salaActual)) return;
    const sala = salas.get(salaActual);
    // Solo el admin de la sala puede actualizar
    if (sala.admin !== socket.id) {
      socket.emit("notAuthorized");
      return;
    }
    sala.state = state;
    io.to(salaActual).emit("state", sala.state);
  });

  socket.on("disconnect", () => {
    // Si el que se desconecta es admin, la sala sigue “viva” como solo-lectura.
    if (salaActual && salas.has(salaActual) && salas.get(salaActual).admin === socket.id) {
      // Opcional: podrías borrar la sala si prefieres
      // salas.delete(salaActual);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Servidor listo en http://localhost:${PORT}`));
