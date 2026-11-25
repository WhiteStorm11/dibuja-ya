const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const registerGames = require('./games');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  connectionStateRecovery: { maxDisconnectionDuration: 60000 }
});

app.use(express.static(path.join(__dirname, 'public')));

// --- Room management ---
const rooms = new Map();
const disconnectTimers = new Map();
const memes = new Map([
  ['drake', { name: 'Drake', url: 'https://i.imgflip.com/30b1gx.jpg' }],
  ['perro', { name: 'This Is Fine', url: 'https://i.imgflip.com/wxica.jpg' }],
  ['botones', { name: 'Dos botones', url: 'https://i.imgflip.com/1g8my4.jpg' }],
  ['pikachu', { name: 'Pikachu sorprendido', url: 'https://i.imgflip.com/2kbn1e.jpg' }],
  ['gato', { name: 'Mujer y gato', url: 'https://i.imgflip.com/345v97.jpg' }],
  ['distraido', { name: 'Novio distraído', url: 'https://i.imgflip.com/1ur9b0.jpg' }]
]);
app.get('/api/memes', (_, res) => {
  res.json(Array.from(memes, ([id, meme]) => ({ id, ...meme })));
});

const clues = new Map([
  ['perro', 'Muevo la cola cuando me alegro y ladro aunque no sepa hablar.'],
  ['gato', 'Tengo bigotes y ronroneo sin llevar motor.'],
  ['casa', 'Tengo puertas y ventanas y te espero cuando vuelves.'],
  ['luna', 'A veces parezco una uña y otras un plato redondo.'],
  ['sol', 'Salgo cada mañana y puedo quemarte sin tocarte.'],
  ['árbol', 'Bebo con los pies y cambio de abrigo con las estaciones.'],
  ['avión', 'Tengo alas, pero nunca las bato.'],
  ['barco', 'Me muevo sin ruedas por un camino de agua.'],
  ['río', 'Tengo corriente y nunca necesito enchufe.'],
  ['guitarra', 'Tengo cuerdas, pero no sirvo para amarrar nada.'],
  ['pelota', 'Me golpean y salgo saltando sin quejarme.'],
  ['reloj', 'Tengo agujas y nunca coso.'],
  ['pizza', 'Soy redonda, llego en una caja cuadrada y me comen en triángulos.'],
  ['helado', 'Entre más calor hace, más rápido desaparezco.'],
  ['dragón', 'En los cuentos vuelo y hago fogatas sin fósforos.'],
  ['fantasma', 'Aparece en historias de casas embrujadas.'],
  ['elefante', 'Puedo beber agua con una nariz muy larga.'],
  ['jirafa', 'Alcanzo las hojas altas sin trepar al árbol.'],
  ['pulpo', 'Con mis brazos podría abrazar a ocho personas a la vez.'],
  ['pingüino', 'Un ave que nada y viste de blanco y negro.'],
  ['bicicleta', 'Tengo dos ruedas y avanzo cuando tú haces el esfuerzo.'],
  ['paraguas', 'Abro mis costillas cuando empieza a llover.'],
  ['libro', 'Puedo contarte historias sin decir una sola palabra en voz alta.'],
  ['volcán', 'Soy una montaña que a veces escupe roca derretida.'],
  ['arcoíris', 'Aparece cuando se encuentran la lluvia y el sol.'],
  ['piano', 'Tengo teclas y con ellas hago música.'],
  ['cámara', 'Atrapo un instante sin ponerle una jaula.'],
  ['dado', 'Tengo caras y puntitos, pero ningún ojo.'],
  ['burbuja', 'Me escapo flotando del jabón y mi nombre tiene dos B.']
]);

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function getRandomWord(usedWords) {
  const available = [...clues.keys()].filter(w => !usedWords.includes(w));
  if (available.length === 0) return 'reloj';
  return available[Math.floor(Math.random() * available.length)];
}

function createRoom(code) {
  return {
    code,
    players: [],       // [{id, name, score}]
    state: 'waiting',  // waiting | playing | finished
    round: 0,
    totalRounds: 10,
    drawerIndex: 0,
    currentWord: '',
    usedWords: [],
    timer: null,
    timeLeft: 60
  };
}

function startRound(room) {
  if (rooms.get(room.code) !== room || room.players.length !== 2) return;
  room.round++;
  if (room.round > room.totalRounds) {
    endGame(room);
    return;
  }

  const word = getRandomWord(room.usedWords);
  room.currentWord = word;
  room.usedWords.push(word);
  room.timeLeft = 60;
  room.state = 'playing';
  room.hintUsed = false;

  const drawer = room.players[room.drawerIndex];
  const guesser = room.players[1 - room.drawerIndex];

  // Tell drawer the word
  io.to(drawer.id).emit('role', {
    role: 'drawer',
    word: word,
    round: room.round,
    totalRounds: room.totalRounds
  });

  // Tell guesser to guess
  io.to(guesser.id).emit('role', {
    role: 'guesser',
    round: room.round,
    totalRounds: room.totalRounds,
    wordLength: [...word].length
  });

  // Broadcast round start
  io.to(room.code).emit('roundStart', {
    round: room.round,
    totalRounds: room.totalRounds,
    drawerName: drawer.name,
    guesserName: guesser.name,
    timeLeft: 60,
    scores: room.players.map(p => ({ name: p.name, score: p.score }))
  });

  // Clear canvas for everyone
  io.to(room.code).emit('clearCanvas');

  // Start timer
  clearInterval(room.timer);
  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(room.code).emit('timerUpdate', room.timeLeft);

    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      room.state = 'betweenRounds';
      // Nobody guessed — reveal word
      io.to(room.code).emit('roundEnd', {
        guessed: false,
        word: room.currentWord,
        scores: room.players.map(p => ({ name: p.name, score: p.score }))
      });

      // Switch drawer and start next round after delay
      room.drawerIndex = 1 - room.drawerIndex;
      room.nextRound = setTimeout(() => startRound(room), 3000);
    }
  }, 1000);
}

function endGame(room) {
  clearInterval(room.timer);
  room.state = 'finished';

  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0].score > sorted[1].score ? sorted[0].name : null;

  io.to(room.code).emit('gameOver', {
    winner,
    scores: room.players.map(p => ({ name: p.name, score: p.score }))
  });

}

// --- Socket.IO ---
io.on('connection', (socket) => {
  clearTimeout(disconnectTimers.get(socket.id));
  disconnectTimers.delete(socket.id);
  if (socket.recovered) socket.emit('roomReady');

  function currentRoom() {
    const room = rooms.get(socket.data.roomCode);
    return room?.players.some(player => player.id === socket.id) ? room : undefined;
  }
  registerGames(io, socket, currentRoom, memes, (room, rounds) => {
    room.round = 0;
    room.totalRounds = rounds;
    room.usedWords = [];
    room.players.forEach(player => { player.score = 0; });
    room.drawerIndex = Math.random() < 0.5 ? 0 : 1;
    io.to(room.code).emit('classicStart');
    startRound(room);
  });

  function sendChat(message) {
    const room = currentRoom();
    if (!room) return;
    const now = Date.now();
    if (now - (socket.data.lastChatAt || 0) < 600) return;
    socket.data.lastChatAt = now;
    const { name } = room.players.find(player => player.id === socket.id);
    io.to(room.code).emit('chatMessage', { name, ...message });
  }

  socket.on('chat', (text) => {
    if (typeof text !== 'string' || !text.trim() || text.length > 250) return;
    sendChat({ text: text.trim() });
  });

  socket.on('meme', (id) => {
    const meme = memes.get(id);
    if (meme) sendChat({ meme });
  });

  socket.on('hint', () => {
    const room = currentRoom();
    if (room?.state !== 'playing' || room.hintUsed ||
        room.players[room.drawerIndex].id === socket.id) return;
    room.hintUsed = true;
    const word = room.currentWord;
    io.to(socket.id).emit('hint', clues.get(word));
  });

  socket.on('createRoom', (name, callback) => {
    if (typeof callback !== 'function') return;
    if (currentRoom() || typeof name !== 'string' || !name.trim() || name.length > 30) {
      return callback({ success: false, error: 'Revisa tu nombre o vuelve al inicio.' });
    }
    const code = generateRoomCode();
    const room = createRoom(code);
    room.players.push({ id: socket.id, name, score: 0 });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    callback({ success: true, code, playerName: name });
    socket.emit('roomReady');
  });

  socket.on('joinRoom', (data, callback) => {
    if (typeof callback !== 'function') return;
    const { code, name } = data || {};
    if (currentRoom() || typeof code !== 'string' || typeof name !== 'string' ||
        !name.trim() || name.length > 30) {
      return callback({ success: false, error: 'Revisa tu nombre y el código.' });
    }
    const room = rooms.get(code.trim().toUpperCase());

    if (!room) return callback({ success: false, error: 'Sala no encontrada' });
    if (room.players.length >= 2) return callback({ success: false, error: 'Sala llena' });
    if (room.state !== 'waiting') return callback({ success: false, error: 'Juego en curso' });

    room.players.push({ id: socket.id, name, score: 0 });
    socket.join(room.code);
    socket.data.roomCode = room.code;
    callback({ success: true, code: room.code, playerName: name });

    // Notify both players
    io.to(room.code).emit('playerJoined', {
      players: room.players.map(p => p.name)
    });

    room.state = 'menu';
  });

  socket.on('draw', (data) => {
    const room = currentRoom();
    if (room?.state !== 'playing' || room.players[room.drawerIndex].id !== socket.id ||
        !data || typeof data !== 'object') return;
    socket.to(room.code).emit('draw', data);
  });

  socket.on('clearCanvas', () => {
    const room = currentRoom();
    if (room?.state !== 'playing' || room.players[room.drawerIndex].id !== socket.id) return;
    socket.to(room.code).emit('clearCanvas');
  });

  socket.on('guess', (text) => {
    if (typeof text !== 'string' || !text.trim() || text.length > 60) return;
    const room = currentRoom();
    if (!room || room.state !== 'playing') return;

    const guesser = room.players.find(p => p.id === socket.id);
    if (!guesser) return;

    // Don't let the drawer guess
    if (room.players[room.drawerIndex].id === socket.id) return;

    // Broadcast the guess to chat
    io.to(room.code).emit('chatMessage', {
      name: guesser.name,
      text,
      guess: true
    });

    // Check if correct
    const normalizedGuess = text.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const normalizedWord = room.currentWord.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    if (normalizedGuess === normalizedWord) {
      clearInterval(room.timer);
      room.state = 'betweenRounds';

      // Points: more time left = more points (min 50, max 100)
      const points = Math.max(50, Math.round(50 + (room.timeLeft / 60) * 50));
      guesser.score += points;

      // Drawer also gets some points
      const drawer = room.players[room.drawerIndex];
      drawer.score += Math.round(points / 2);

      io.to(room.code).emit('roundEnd', {
        guessed: true,
        word: room.currentWord,
        guesserName: guesser.name,
        points,
        scores: room.players.map(p => ({ name: p.name, score: p.score }))
      });

      // Switch turns
      room.drawerIndex = 1 - room.drawerIndex;
      room.nextRound = setTimeout(() => startRound(room), 3000);
    }
  });

  socket.on('disconnect', () => {
    const room = currentRoom();
    if (!room) return;
    disconnectTimers.set(socket.id, setTimeout(() => {
      disconnectTimers.delete(socket.id);
      if (rooms.get(room.code) !== room || io.sockets.sockets.has(socket.id)) return;
      clearInterval(room.timer);
      clearTimeout(room.nextRound);
      clearTimeout(room.activity?.timer);
      rooms.delete(room.code);
      io.to(room.code).emit('opponentLeft');
      io.in(room.code).socketsLeave(room.code);
    }, 60000));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎨 Dibuja Ya! corriendo en puerto ${PORT}`);
});
