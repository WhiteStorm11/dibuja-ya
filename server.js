const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  connectionStateRecovery: { maxDisconnectionDuration: 60000 }
});

app.use(express.static(path.join(__dirname, 'public')));

// --- Word list (Spanish) ---
const WORDS = [
  'perro', 'gato', 'casa', 'sol', 'luna', 'árbol', 'flor', 'carro',
  'avión', 'barco', 'montaña', 'río', 'playa', 'estrella', 'corazón',
  'guitarra', 'pelota', 'zapato', 'sombrero', 'lentes', 'reloj',
  'teléfono', 'computadora', 'pizza', 'hamburguesa', 'helado', 'pastel',
  'dinosaurio', 'dragón', 'unicornio', 'robot', 'cohete', 'planeta',
  'corona', 'espada', 'castillo', 'pirata', 'fantasma', 'araña',
  'mariposa', 'serpiente', 'elefante', 'jirafa', 'león', 'delfín',
  'tiburón', 'pulpo', 'tortuga', 'pingüino', 'loro', 'águila',
  'bicicleta', 'tren', 'autobús', 'moto', 'globo', 'paraguas',
  'cámara', 'libro', 'lápiz', 'tijeras', 'martillo', 'llave',
  'bombilla', 'vela', 'campana', 'bandera', 'mapa', 'brújula',
  'ancla', 'dado', 'paleta', 'cactus', 'volcán', 'arcoíris',
  'nube', 'rayo', 'fuego', 'agua', 'hielo', 'tornado',
  'payaso', 'astronauta', 'ninja', 'sirena', 'ángel', 'momia',
  'vampiro', 'zombie', 'alienígena', 'superhéroe', 'mago', 'hada',
  'piano', 'batería', 'trompeta', 'violín', 'micrófono', 'audífonos',
  'televisor', 'control', 'ratón', 'teclado', 'impresora', 'USB',
  'sandía', 'piña', 'plátano', 'manzana', 'cereza', 'uva',
  'zanahoria', 'brócoli', 'champiñón', 'maíz', 'huevo', 'queso',
  'café', 'jugo', 'palomitas', 'dona', 'galleta', 'chocolate',
  'cama', 'silla', 'mesa', 'lámpara', 'espejo', 'escalera',
  'puerta', 'ventana', 'chimenea', 'piscina', 'columpio', 'resbalón',
  'balón', 'raqueta', 'patines', 'esquí', 'surfear', 'boxeo',
  'corona', 'anillo', 'collar', 'diamante', 'cofre', 'medalla',
  'semáforo', 'taxi', 'ambulancia', 'policía', 'bombero', 'hospital'
];

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
  ['perro', 'Ladra'], ['gato', 'Bigotes'], ['casa', 'Hogar'],
  ['luna', 'Satélite'], ['sol', 'Estrella'], ['árbol', 'Raíces'],
  ['flor', 'Pétalos'], ['carro', 'Volante'], ['avión', 'Altitud'],
  ['barco', 'Navegación'], ['montaña', 'Cumbre'], ['río', 'Corriente'],
  ['playa', 'Arena'], ['guitarra', 'Cuerdas'], ['pelota', 'Rebote'],
  ['zapato', 'Cordones'], ['reloj', '¿Qué tiene agujas y nunca cose?'],
  ['pizza', 'Porciones'], ['helado', 'Congelado'], ['dinosaurio', 'Fósil'],
  ['dragón', 'Escupe fuego en los cuentos.'], ['cohete', 'Despegue'],
  ['fantasma', 'Aparece en historias de casas embrujadas.'],
  ['elefante', 'Trompa'], ['jirafa', 'Cuello'], ['pulpo', 'Ocho brazos'],
  ['pingüino', 'Un ave que nada y viste de blanco y negro.'],
  ['bicicleta', 'Pedales'], ['paraguas', 'Se abre cuando cae agua del cielo.'],
  ['libro', 'Páginas'], ['brújula', 'Norte'], ['volcán', 'Lava'],
  ['arcoíris', 'Aparece cuando se encuentran la lluvia y el sol.'],
  ['piano', 'Teclas'], ['cámara', 'Fotografía'], ['dado', 'Tiene caras pero no ojos.']
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
  const available = WORDS.filter(w => !usedWords.includes(w));
  if (available.length === 0) return WORDS[Math.floor(Math.random() * WORDS.length)];
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
      setTimeout(() => startRound(room), 3000);
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

  // Cleanup room after 30s
  setTimeout(() => rooms.delete(room.code), 30000);
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

  function sendChat(message) {
    const room = currentRoom();
    if (!room || room.state === 'finished') return;
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
    const hint = clues.get(word) || `Comienza con «${word[0].toUpperCase()}» y termina con «${word.at(-1).toUpperCase()}».`;
    io.to(socket.id).emit('hint', hint);
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

    // Start game after short delay
    setTimeout(() => {
      room.drawerIndex = Math.random() < 0.5 ? 0 : 1;
      startRound(room);
    }, 2000);
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
      setTimeout(() => startRound(room), 3000);
    }
  });

  socket.on('disconnect', () => {
    const room = currentRoom();
    if (!room) return;
    disconnectTimers.set(socket.id, setTimeout(() => {
      disconnectTimers.delete(socket.id);
      if (rooms.get(room.code) !== room || io.sockets.sockets.has(socket.id)) return;
      clearInterval(room.timer);
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
