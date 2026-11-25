const { randomInt } = require('node:crypto');

const flags = [
  { name: 'Colombia', colors: ['#fcd116', '#003893', '#ce1126'], grid: [0,0,0,0,0,0,1,1,1,2,2,2] },
  { name: 'Francia', colors: ['#0055a4', '#ffffff', '#ef4135'], grid: [0,1,2,0,1,2,0,1,2,0,1,2] },
  { name: 'Ucrania', colors: ['#0057b7', '#ffd700'], grid: [0,0,0,0,0,0,1,1,1,1,1,1] },
  { name: 'Italia', colors: ['#009246', '#ffffff', '#ce2b37'], grid: [0,1,2,0,1,2,0,1,2,0,1,2] }
];
const art = [
  { name: 'Corazón', rows: ['.......','.11.11.','1221221','1222221','.12221.','..121..','...1...'], colors: ['#f43f5e','#fda4af'] },
  { name: 'Flor', rows: ['...1...','..121..','.12221.','..121..','...3...','.3.3.3.','..333..'], colors: ['#a855f7','#facc15','#22c55e'] },
  { name: 'Fantasma', rows: ['..111..','.11111.','.12121.','.11111.','.11311.','.11111.','.1.1.1.'], colors: ['#ddd6fe','#312e81','#f472b6'] }
];
const palette = ['#f43f5e', '#fda4af', '#a855f7', '#facc15', '#22c55e', '#ddd6fe', '#312e81', '#f472b6', '#38bdf8', '#ffffff'];
const clean = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const normal = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function shuffled(size) {
  const pieces = Array.from({ length: size }, (_, index) => index);
  for (let index = size - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [pieces[index], pieces[other]] = [pieces[other], pieces[index]];
  }
  return pieces;
}

function publish(io, room) {
  const activity = room.activity;
  for (const [index, player] of room.players.entries()) {
    const { secret, riddle, timer, target, strokes, ...visible } = activity;
    const guide = index === activity.guide;
    io.to(player.id).emit('activity', {
      ...visible, guide,
      strokes: activity.done ? strokes : undefined,
      solution: (activity.done || (guide && activity.mode === 'flag')) ? target : undefined,
      secret: guide || activity.done || activity.mode === 'challenge' ? secret : undefined,
      riddle: activity.hintUsed || guide ? riddle : undefined
    });
  }
}

function validPoint(point) {
  return point && [point.x, point.y].every(value => Number.isFinite(value) && value >= 0 && value <= 1);
}

module.exports = function registerGames(io, socket, currentRoom, memes, startClassic) {
  socket.on('chooseGame', (data) => {
    const room = currentRoom();
    if (!room || room.players.length !== 2 || !data ||
        !['menu', 'finished', 'activity'].includes(room.state)) return;
    const previous = room.activity;
    const mode = data.mode;
    if (!['classic', 'challenge', 'word', 'puzzle', 'flag', 'color'].includes(mode)) return;
    if (room.state === 'activity' && previous && !previous.done) return;
    const photo = mode === 'puzzle' ? data.photo : undefined;
    if (photo !== undefined && (typeof photo !== 'string' || photo.length > 280000 ||
        !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo))) return;
    clearTimeout(previous?.timer);
    if (mode === 'classic') {
      room.activity = undefined;
      startClassic(room, [4, 6, 10].includes(data.rounds) ? data.rounds : 10);
      return;
    }

    const rotation = (room.rotations ||= {});
    const turn = rotation[mode] || 0;
    rotation[mode] = turn + 1;
    const activity = { mode, guide: turn % 2, done: false };
    room.state = 'activity';
    room.activity = activity;

    if (mode === 'puzzle') {
      const images = [...memes.values()];
      activity.image = photo ? { name: 'Foto de la sala', url: photo } : images[turn % images.length];
      activity.size = photo || data.size === 4 ? 4 : 3;
      activity.pieces = shuffled(activity.size ** 2);
      activity.cells = Array(activity.pieces.length).fill(null);
    } else if (mode === 'flag') {
      const flag = flags[turn % flags.length];
      activity.title = flag.name;
      activity.colors = flag.colors;
      activity.target = flag.grid;
      activity.cells = flag.grid.map((color, index) => index % 3 === 0 ? color : null);
      activity.fixed = activity.cells.map(color => color !== null);
    } else if (mode === 'color') {
      const picture = art[turn % art.length];
      activity.title = picture.name;
      activity.colors = palette;
      activity.target = picture.rows.join('').split('').map(cell => cell === '.' ? -1 :
        palette.indexOf(picture.colors[Number(cell) - 1]));
      activity.free = data.free === true;
      activity.cells = activity.target.map(color => color === -1 ? -1 : null);
      if (!activity.free) activity.reference = activity.target;
    } else {
      activity.phase = 'prepare';
      if (mode === 'word') activity.questions = [];
      else activity.strokes = [];
    }
    publish(io, room);
  });

  socket.on('gamesMenu', () => {
    const room = currentRoom();
    if (!room || room.players.length !== 2) return;
    clearInterval(room.timer);
    clearTimeout(room.nextRound);
    clearTimeout(room.activity?.timer);
    room.activity = undefined;
    room.state = 'menu';
    io.to(room.code).emit('gamesMenu');
  });

  socket.on('activityAction', (action) => {
    const room = currentRoom();
    const game = room?.activity;
    if (room?.state !== 'activity' || !game || game.done || !action) return;
    const guide = socket.id === room.players[game.guide].id;
    const { type, index, value } = action;

    if (game.mode === 'puzzle' && type === 'place') {
      if (!Number.isInteger(index) || index !== value || game.cells[index] !== null ||
          !game.pieces.includes(value)) return;
      game.cells[index] = value;
      game.done = game.cells.every(cell => cell !== null);
    } else if (game.mode === 'flag' && type === 'paint') {
      if (guide || !Number.isInteger(index) || index < 0 || index >= game.cells.length ||
          game.fixed[index] || !Number.isInteger(value) || value < 0 || value >= game.colors.length) return;
      game.cells[index] = value;
      game.done = game.cells.every((cell, position) => cell === game.target[position]);
    } else if (game.mode === 'color' && type === 'paint') {
      if (!Number.isInteger(index) || index < 0 || index >= game.cells.length ||
          game.cells[index] === -1 || !Number.isInteger(value) || value < 0 || value >= game.colors.length) return;
      game.cells[index] = value;
      game.done = game.cells.every((cell, position) => game.free ? cell !== null : cell === game.target[position]);
    } else if (game.mode === 'word') {
      if (guide && type === 'prepare' && game.phase === 'prepare') {
        const secret = clean(value, 45);
        const riddle = clean(action.riddle, 160);
        if (!secret || !riddle || normal(secret) === normal(riddle)) return;
        game.secret = secret;
        game.riddle = riddle;
        game.phase = 'play';
      } else if (!guide && game.phase === 'play' && type === 'question') {
        const question = clean(value, 150);
        if (!question || game.questions.length >= 5 || game.questions.some(item => !item.answer)) return;
        game.questions.push({ question });
      } else if (guide && type === 'answer' && ['Sí', 'No'].includes(value)) {
        const pending = game.questions.at(-1);
        if (!pending || pending.answer) return;
        pending.answer = value;
      } else if (!guide && game.phase === 'play' && type === 'hint') {
        game.hintUsed = true;
      } else if (!guide && game.phase === 'play' && type === 'guess') {
        const guess = clean(value, 45);
        if (!guess) return;
        game.lastGuess = guess;
        game.correct = normal(guess) === normal(game.secret);
        game.done = game.correct;
      } else if (!guide && game.phase === 'play' && type === 'reveal') {
        game.done = true;
      } else return;
    } else if (game.mode === 'challenge') {
      if (guide && type === 'prepare' && game.phase === 'prepare') {
        const prompt = clean(value, 150);
        if (!prompt) return;
        game.secret = prompt;
        game.phase = 'play';
        game.deadline = Date.now() + 45000;
        game.timer = setTimeout(() => {
          game.done = true;
          publish(io, room);
        }, 45000);
      } else if (!guide && game.phase === 'play' && type === 'stroke') {
        if (game.strokes.length >= 3500 || !validPoint(action.from) || !validPoint(action.to)) return;
        game.strokes.push({ from: action.from, to: action.to });
        return;
      } else if (!guide && game.phase === 'play' && type === 'finish') {
        clearTimeout(game.timer);
        game.done = true;
      } else return;
    } else return;

    publish(io, room);
  });
};
