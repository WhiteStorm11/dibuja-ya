const { randomInt } = require('node:crypto');

const flags = [
  { name: 'Colombia', colors: ['#fcd116', '#003893', '#ce1126'], grid: [0,0,0,0,0,0,1,1,1,2,2,2] },
  { name: 'Francia', colors: ['#0055a4', '#ffffff', '#ef4135'], grid: [0,1,2,0,1,2,0,1,2,0,1,2] },
  { name: 'Ucrania', colors: ['#0057b7', '#ffd700'], grid: [0,0,0,0,0,0,1,1,1,1,1,1] },
  { name: 'Italia', colors: ['#009246', '#ffffff', '#ce2b37'], grid: [0,1,2,0,1,2,0,1,2,0,1,2] }
];
const art = [
  { name: 'Gato en la ventana', regions: [
    ['Marco', '#a855f7', 'M30 25H290V235H30Z'],
    ['Cielo', '#38bdf8', 'M46 41H274V219H46Z'],
    ['Luna', '#facc15', 'M238 88a24 24 0 1 1 -48 0a24 24 0 1 1 48 0Z'],
    ['Cuerpo del gato', '#f97316', 'M101 215Q103 153 161 149Q220 150 225 215Z'],
    ['Cabeza del gato', '#f97316', 'M111 125L108 75L145 99Q160 94 176 100L210 75L209 126Q215 171 160 174Q105 171 111 125Z'],
    ['Nariz', '#f472b6', 'M151 141H169L160 151Z']
  ], details: 'M128 130q7-10 14 0m36 0q7-10 14 0M160 151q-5 10-13 6m13-6q5 10 13 6' },
  { name: 'Cohete y planetas', regions: [
    ['Espacio', '#312e81', 'M16 16H304V244H16Z'],
    ['Planeta', '#a855f7', 'M116 80a33 33 0 1 1-66 0a33 33 0 1 1 66 0Z'],
    ['Anillo', '#f472b6', 'M44 95Q36 83 80 72Q126 60 128 72Q127 83 83 94Q52 103 44 95Z'],
    ['Llama', '#facc15', 'M153 183Q143 210 166 230Q202 209 186 183Z'],
    ['Aletas', '#f43f5e', 'M147 133L123 185L163 174H174L211 185L188 133Z'],
    ['Cohete', '#ffffff', 'M168 34Q125 75 147 171H190Q211 75 168 34Z'],
    ['Ventana', '#38bdf8', 'M184 103a16 16 0 1 1-32 0a16 16 0 1 1 32 0Z']
  ], details: 'M239 61v18m-9-9h18m-7 92v20m-10-10h20M71 178v15m-7-7h14' },
  { name: 'Tienda de helados', regions: [
    ['Cielo', '#38bdf8', 'M16 16H304V244H16Z'],
    ['Mostrador', '#a855f7', 'M38 163H282V244H38Z'],
    ['Cono', '#f97316', 'M118 123H202L160 221Z'],
    ['Bola de fresa', '#fda4af', 'M110 132Q103 110 121 104Q117 67 158 66Q200 65 198 104Q220 111 210 132Z'],
    ['Cereza', '#f43f5e', 'M173 58a13 13 0 1 1-26 0a13 13 0 1 1 26 0Z']
  ], details: 'M160 45q1-15 14-19M127 144l50 38m-40-24 29 26m25-39-44 32m34-15-28 24' },
  { name: 'Tortuga en el mar', regions: [
    ['Mar', '#38bdf8', 'M16 16H304V244H16Z'],
    ['Aletas', '#22c55e', 'M96 137Q63 174 114 171L177 160Q190 199 215 168L204 129Z'],
    ['Cabeza', '#22c55e', 'M213 107Q233 71 266 93Q291 128 244 136L205 127Z'],
    ['Caparazón', '#a855f7', 'M70 135Q88 59 156 61Q209 69 224 137Q150 168 70 135Z'],
    ['Centro del caparazón', '#facc15', 'M117 104L147 77L180 104L166 138H132Z']
  ], details: 'M249 107h2m-14 10q8 9 16 1M35 68q12-8 24 0m195 122q12-8 24 0M37 205q12-8 24 0' },
  { name: 'Casita entre montañas', regions: [
    ['Cielo', '#38bdf8', 'M16 16H304V244H16Z'],
    ['Sol', '#facc15', 'M268 63a20 20 0 1 1-40 0a20 20 0 1 1 40 0Z'],
    ['Montañas', '#a855f7', 'M16 156L91 60L157 139L215 70L304 172V244H16Z'],
    ['Pradera', '#22c55e', 'M16 184Q92 146 160 181Q225 207 304 166V244H16Z'],
    ['Casa', '#facc15', 'M126 162H219V226H126Z'],
    ['Techo', '#f43f5e', 'M115 167L171 115L230 167Z'],
    ['Puerta', '#f97316', 'M159 188H184V226H159Z'],
    ['Ventana', '#ffffff', 'M192 180H211V199H192Z']
  ], details: 'M201 180v19m-9-9h19' }
];
const palette = ['#f43f5e', '#fda4af', '#a855f7', '#facc15', '#22c55e', '#ddd6fe', '#312e81', '#f472b6', '#38bdf8', '#ffffff', '#f97316'];
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
      startClassic(room, [4, 6, 10, 15, 20, 30].includes(data.rounds) ? data.rounds : 10);
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
      activity.target = picture.regions.map(([, color]) => palette.indexOf(color));
      activity.regions = picture.regions.map(([name, , path]) => ({ name, path }));
      activity.details = picture.details;
      activity.free = data.free === true;
      activity.cells = activity.target.map(() => null);
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
