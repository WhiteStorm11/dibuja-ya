const hub = document.getElementById('gameHub');
const catalogGames = [
  ['classic', 'Dibuja y adivina', 'Tú dibujas, tu pareja adivina.'],
  ['challenge', 'Reto de dibujo', 'Escribe el reto que dibujará tu pareja.'],
  ['word', 'Adivina mi palabra', 'Cinco preguntas de sí o no y una adivinanza.'],
  ['puzzle', 'Rompecabezas de memes', 'Armen el mismo meme entre los dos.'],
  ['flag', 'Completen la bandera', 'Uno guía y el otro rellena las partes que faltan.'],
  ['color', 'Coloreen juntos', 'Rellenen el mismo dibujo, con o sin referencia.']
];
const drawingModes = new Set(['classic', 'challenge', 'color']);
const challengeIdeas = [
  'Un gato vendiendo empanadas en la Luna', 'Una arepa con capa de superhéroe',
  'Un dinosaurio tratando de tomarse una selfie', 'Una tortuga ganando una carrera de Fórmula 1',
  'Dos fantasmas que se asustan entre sí', 'Un pingüino tomando el sol en Cartagena',
  'Un robot enamorado de una tostadora', 'Un volcán que hace burbujas de jabón',
  'Una abeja repartiendo pizzas en bicicleta', 'Un aguacate aprendiendo a bailar salsa',
  'Un perro dirigiendo una orquesta de gatos', 'Una ballena que se olvidó de su paraguas',
  'Un cocodrilo en la silla del dentista', 'Una montaña rusa que pasa por las nubes',
  'Un caracol haciendo entregas urgentes', 'Una sirena jugando fútbol bajo el agua',
  'Un monstruo que tiene miedo a las cosquillas', 'Un conejo con el trabajo de cuidar la Luna',
  'Una sandía haciendo surf', 'Una impresora que solo imprime hamburguesas',
  'Un dragón preparando un chocolate caliente', 'Un pulpo jugando ocho partidas a la vez',
  'Una medusa dando clases de baile', 'Dos marcianos celebrando un cumpleaños',
  'Un oso tratando de esconderse detrás de una flor', 'Un mapache robándose una piñata',
  'Una flor tomando fotos en un safari', 'Un tiburón cuidando una tienda de dulces',
  'Un zorro tratando de caminar con tacones', 'Un cohete que aterriza en un plato de sopa',
  'Una rana presentando el noticiero', 'Un dinosaurio haciendo mercado con un carrito diminuto',
  'Un pollito con su propia banda de rock', 'Dos pandas armando un mueble sin instrucciones',
  'Un extraterrestre descubriendo el café', 'Un perro y un gato cambiando de trabajo'
];
const colorNames = ['Rojo', 'Rosa claro', 'Morado', 'Amarillo', 'Verde', 'Lavanda', 'Índigo', 'Fucsia', 'Azul', 'Blanco', 'Naranja'];
let activity;
let choice;
let activityClock;

function element(tag, label, parent = hub, className = '') {
  const node = document.createElement(tag);
  node.textContent = label;
  node.className = className;
  parent.append(node);
  return node;
}

function actionButton(label, run, parent = hub) {
  const button = element('button', label, parent, 'game-action');
  button.type = 'button';
  button.addEventListener('click', run);
  return button;
}

function act(type, value, details = {}) {
  if (socket.connected) socket.emit('activityAction', { type, value, ...details });
}

function selectGame(mode, options = {}) {
  choice = undefined;
  socket.emit('chooseGame', { mode, ...options });
}

function photoPicker(parent) {
  const field = element('input', '', parent);
  field.type = 'file';
  field.accept = 'image/*';
  field.hidden = true;
  const button = actionButton('Usar mi foto · 16 piezas', () => field.click(), parent);
  const status = element('p', '', parent, 'hub-status');
  status.setAttribute('role', 'status');
  field.addEventListener('change', async () => {
    const file = field.files[0];
    field.value = '';
    if (!file || !socket.connected) return;
    if (file.size > 20000000) {
      status.textContent = 'Elige una imagen de hasta 20 MB.';
      return;
    }
    button.disabled = true;
    status.textContent = 'Preparando la foto…';
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.width = canvas.height = Math.max(width, height);
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      let photo = canvas.toDataURL('image/jpeg', 0.78);
      if (photo.length > 280000) photo = canvas.toDataURL('image/jpeg', 0.55);
      if (photo.length > 280000) throw new Error('Foto demasiado grande');
      if (field.isConnected && socket.connected) selectGame('puzzle', { photo });
      status.textContent = '';
    } catch {
      status.textContent = 'No pudimos abrir la foto. Prueba con una imagen JPG o PNG.';
    } finally {
      bitmap?.close();
      button.disabled = false;
    }
  });
}

function openHub() {
  clearInterval(activityClock);
  document.getElementById('game').classList.add('hub-open');
  document.getElementById('roundOverlay').classList.remove('active');
  hub.hidden = false;
  hub.replaceChildren();
  showScreen('game');
}

function showGameMenu() {
  activity = undefined;
  choice = undefined;
  openHub();
  element('h2', 'Juegos para dos', hub, 'hub-heading');
  const cards = element('div', '', hub, 'hub-choices');
  const options = element('div', '', hub, 'hub-controls');
  for (const [mode, title, description] of catalogGames) {
    if (!drawingModes.has(mode)) continue;
    const card = actionButton(title, () => {
      options.replaceChildren();
      if (mode === 'classic') {
        for (const rounds of [4, 6, 10, 15, 20, 30]) {
          actionButton(`${rounds} rondas`, () => selectGame(mode, { rounds }), options);
        }
      } else if (mode === 'puzzle') {
        for (const size of [3, 4]) {
          actionButton(`${size ** 2} piezas`, () => selectGame(mode, { size }), options);
        }
        photoPicker(options);
      } else if (mode === 'color') {
        actionButton('Con referencia', () => selectGame(mode), options);
        actionButton('Colores libres', () => selectGame(mode, { free: true }), options);
      } else selectGame(mode);
      if (options.children.length) options.scrollIntoView({ block: 'nearest' });
    }, cards);
    card.classList.add('hub-card');
    element('span', description, card);
  }
}

function grid(parent, columns) {
  const node = element('div', '', parent, 'hub-grid');
  node.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  return node;
}

function choose(value, button, parent) {
  choice = value;
  for (const item of parent.querySelectorAll('button')) {
    item.setAttribute('aria-pressed', String(item === button));
  }
}

function imagePiece(button, image, size, index) {
  button.style.backgroundImage = `url("${image.url}")`;
  button.style.backgroundSize = `${size * 100}% ${size * 100}%`;
  button.style.backgroundPosition = `${(index % size) * 100 / (size - 1)}% ${Math.floor(index / size) * 100 / (size - 1)}%`;
}

function renderPuzzle(game) {
  if (game.cells.includes(choice)) choice = undefined;
  const status = element('p', game.done ? `¡Meme completo! ${game.image.name}` :
    `${game.cells.filter(cell => cell !== null).length} de ${game.cells.length} piezas. Toca una pieza y luego su lugar.`, hub, 'hub-status');
  status.setAttribute('role', 'status');
  const boards = element('div', '', hub, 'hub-board');
  const target = element('div', '', boards);
  element('h3', 'Tablero', target);
  const slots = grid(target, game.size);
  game.cells.forEach((cell, index) => {
    const button = actionButton(cell === null ? String(index + 1) : '', () => {
      if (choice === undefined) return;
      if (choice !== index) {
        status.textContent = 'Esa pieza va en otro lugar. Prueba de nuevo.';
        return;
      }
      act('place', choice, { index });
    }, slots);
    button.setAttribute('aria-label', `Lugar ${index + 1}`);
    button.disabled = cell !== null;
    if (cell !== null) imagePiece(button, game.image, game.size, cell);
  });
  if (game.done) {
    actionButton('Otro meme', () => selectGame('puzzle', { size: game.size }));
    photoPicker(hub);
    return;
  }
  const source = element('div', '', boards);
  element('h3', 'Piezas', source);
  const pieces = grid(source, game.size);
  game.pieces.filter(piece => !game.cells.includes(piece)).forEach((piece, index) => {
    const button = actionButton('', () => choose(piece, button, pieces), pieces);
    button.setAttribute('aria-label', `Pieza disponible ${index + 1}`);
    button.setAttribute('aria-pressed', String(choice === piece));
    imagePiece(button, game.image, game.size, piece);
  });
}

function paintBoard(cells, columns, colors, parent, paint, fixed = []) {
  const board = grid(parent, columns);
  cells.forEach((color, index) => {
    const button = actionButton('', () => paint?.(index), board);
    button.setAttribute('aria-label', `Casilla ${index + 1}, ${colors[color] || 'sin pintar'}`);
    button.disabled = !paint || fixed[index] || color === -1;
    if (color === -1) button.classList.add('blank');
    if (colors[color]) button.style.backgroundColor = colors[color];
  });
}

function saveArt(drawing) {
  const link = document.createElement('a');
  link.download = 'dibuja-ya-coloreado.png';
  link.href = drawing.toDataURL('image/png');
  link.click();
}

function illustration(game, cells, parent, paint) {
  const canvas = element('canvas', '', parent, 'color-illustration');
  canvas.width = 640;
  canvas.height = 520;
  canvas.setAttribute('aria-label', game.title);
  const context = canvas.getContext('2d');
  context.scale(2, 2);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, 320, 260);
  context.strokeStyle = '#211833';
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.lineWidth = 2.5;
  const paths = game.regions.map(region => new Path2D(region.path));
  paths.forEach((path, index) => {
    context.fillStyle = game.colors[cells[index]] || '#fff';
    context.fill(path);
    context.stroke(path);
  });
  context.stroke(new Path2D(game.details));
  if (paint) {
    canvas.addEventListener('click', event => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * canvas.width / rect.width;
      const y = (event.clientY - rect.top) * canvas.height / rect.height;
      const index = paths.findLastIndex(path => context.isPointInPath(path, x, y));
      if (index >= 0) paint(index);
    });
  }
  return canvas;
}

function renderPaint(game) {
  const flag = game.mode === 'flag';
  const columns = flag ? 3 : 7;
  const canPaint = !game.done && (!flag || !game.guide);
  element('h3', game.title);
  element('p', game.done ? '¡Lo completaron!' : flag ?
    (game.guide ? 'Guía a tu pareja por chat. Solo tú ves la referencia.' : 'Completa las casillas con las indicaciones de tu pareja.') :
    (game.free ? 'Elijan juntos los colores.' : 'Rellenen las casillas siguiendo la referencia.'), hub, 'hub-status');
  if (canPaint) {
    const palette = element('div', '', hub, 'hub-palette');
    for (const [index, color] of game.colors.entries()) {
      const button = actionButton(flag ? `Color ${index + 1}` : colorNames[index], () => choose(index, button, palette), palette);
      button.style.borderBottom = `5px solid ${color}`;
      button.setAttribute('aria-pressed', String(choice === index));
    }
  }
  const boards = element('div', '', hub, 'hub-board');
  const main = element('div', '', boards);
  element('h3', 'Tablero compartido', main);
  const paint = canPaint ? index => {
    if (choice !== undefined) act('paint', choice, { index });
  } : undefined;
  let drawing;
  if (flag) {
    paintBoard(game.cells, columns, game.colors, main, paint, game.fixed);
  } else {
    drawing = illustration(game, game.cells, main, paint);
    if (paint) {
      const regions = element('div', '', main, 'hub-controls');
      game.regions.forEach((region, index) => actionButton(region.name, () => paint(index), regions));
    }
  }
  const reference = flag ? game.solution : game.reference;
  if (reference) {
    const panel = element('div', '', boards);
    element('h3', 'Referencia', panel);
    if (flag) paintBoard(reference, columns, game.colors, panel);
    else illustration(game, reference, panel);
  }
  if (game.done) {
    if (!flag) actionButton('Guardar PNG', () => saveArt(drawing));
    actionButton(flag ? 'Siguiente bandera' : 'Otro dibujo', () => selectGame(game.mode, { free: game.free }));
  }
}

function input(label, limit) {
  const field = element('input', '', hub, 'hub-field');
  field.placeholder = label;
  field.setAttribute('aria-label', label);
  field.maxLength = limit;
  field.autocomplete = 'off';
  return field;
}

function renderWord(game) {
  if (game.phase === 'prepare') {
    if (!game.guide) return element('p', 'Tu pareja está preparando la palabra.');
    const secret = input('Palabra secreta', 45);
    const riddle = input('Adivinanza para la pista', 160);
    actionButton('Empezar', () => {
      if (!secret.value.trim() || !riddle.value.trim() ||
          secret.value.trim().toLowerCase() === riddle.value.trim().toLowerCase()) {
        riddle.setCustomValidity('Escribe una adivinanza diferente de la palabra.');
        riddle.reportValidity();
        riddle.setCustomValidity('');
        return;
      }
      act('prepare', secret.value, { riddle: riddle.value });
    });
    return;
  }
  if (game.secret) element('p', `Palabra: ${game.secret}`);
  if (game.riddle) element('p', `Adivinanza: ${game.riddle}`);
  element('p', `${game.questions.length} de 5 preguntas`);
  const list = element('ol', '', hub, 'hub-questions');
  for (const item of game.questions) element('li', `${item.question} — ${item.answer || 'Pendiente'}`, list);
  if (game.lastGuess) element('p', game.correct ? '¡Acertaron!' : `Intento: ${game.lastGuess}`);
  if (game.done) {
    actionButton('Cambiar roles', () => selectGame('word'));
    return;
  }
  if (game.guide) {
    if (game.questions.some(item => !item.answer)) {
      for (const answer of ['Sí', 'No']) actionButton(answer, () => act('answer', answer));
    }
    return;
  }
  if (game.questions.length < 5 && !game.questions.some(item => !item.answer)) {
    const question = input('Pregunta de sí o no', 150);
    actionButton('Preguntar', () => act('question', question.value));
  }
  const guess = input('Tu respuesta', 45);
  actionButton('Adivinar', () => act('guess', guess.value));
  if (!game.hintUsed) actionButton('💡 Pista', () => act('hint'));
  actionButton('Revelar palabra', () => act('reveal'));
}

function renderChallenge(game) {
  if (game.phase === 'prepare') {
    if (!game.guide) return element('p', 'Tu pareja está preparando el reto.');
    const prompt = input('¿Qué quieres que dibuje?', 150);
    const ideas = [...challengeIdeas];
    actionButton('🎲 Dame una idea', () => {
      if (!ideas.length) ideas.push(...challengeIdeas);
      const [idea] = ideas.splice(Math.floor(Math.random() * ideas.length), 1);
      prompt.value = idea;
    });
    actionButton('Enviar reto', () => act('prepare', prompt.value));
    return;
  }
  if (game.secret) element('p', game.secret);
  const clock = element('p', '', hub, 'hub-status');
  if (game.done) {
    clock.textContent = '¡Este es el resultado!';
    actionButton('Cambiar roles', () => selectGame('challenge'));
  } else {
    const tick = () => {
      clock.textContent = `${game.guide ? 'Tu pareja está dibujando. ' : ''}${Math.max(0, Math.ceil((game.deadline - Date.now()) / 1000))} s`;
    };
    tick();
    activityClock = setInterval(tick, 250);
    if (game.guide) return;
    actionButton('Mostrar dibujo', () => act('finish'));
  }
  const board = element('canvas', '', hub, 'challenge-canvas');
  board.width = 600;
  board.height = 420;
  board.setAttribute('aria-label', 'Lienzo del reto');
  const context = board.getContext('2d');
  context.lineWidth = 5;
  context.lineCap = 'round';
  function line(from, to) {
    context.beginPath();
    context.moveTo(from.x * board.width, from.y * board.height);
    context.lineTo(to.x * board.width, to.y * board.height);
    context.stroke();
  }
  if (game.done) {
    for (const stroke of game.strokes) line(stroke.from, stroke.to);
    return;
  }
  let last;
  function position(event) {
    const rect = board.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    };
  }
  board.addEventListener('pointerdown', event => {
    board.setPointerCapture(event.pointerId);
    last = position(event);
  });
  board.addEventListener('pointermove', event => {
    if (!last || !socket.connected) return;
    const next = position(event);
    line(last, next);
    act('stroke', undefined, { from: last, to: next });
    last = next;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    board.addEventListener(event, () => { last = undefined; });
  }
}

socket.on('activity', game => {
  if (activity?.mode !== game.mode || activity?.done) choice = undefined;
  activity = game;
  openHub();
  element('h2', catalogGames.find(([mode]) => mode === game.mode)[1], hub, 'hub-heading');
  if (game.mode === 'puzzle') renderPuzzle(game);
  else if (game.mode === 'flag' || game.mode === 'color') renderPaint(game);
  else if (game.mode === 'word') renderWord(game);
  else renderChallenge(game);
});
socket.on('gamesMenu', showGameMenu);
socket.on('classicStart', () => {
  activity = undefined;
  clearInterval(activityClock);
  hub.hidden = true;
  document.getElementById('game').classList.remove('hub-open');
  showScreen('game');
});
document.getElementById('gamesBack').addEventListener('click', () => {
  if (!hub.hidden && !activity) return;
  if (activity?.done || window.confirm('¿Volver a los juegos para los dos?')) socket.emit('gamesMenu');
});
