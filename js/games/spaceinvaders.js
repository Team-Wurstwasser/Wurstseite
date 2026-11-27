(() => {
'use strict';

/* ---------- Konstanten (wie im C#-Original) ---------- */
const W = 57, H = 30;            // weite, hoehe
const CW = 16, CH = 20;          // Zellgröße auf dem Canvas
const PY = 25;                   // playerY
const UFO_Y = 2;
const SCHUTZ_X = [8, 20, 32, 44], SCHUTZ_H = 3, SCHUTZ_B = 5;
const DIFFS = [                  // Easy, Normal, Hard, Expert, Nightmare
  { gegner: 50, schutz: true,  schuss: 10, leben: 5 },
  { gegner: 60, schutz: true,  schuss: 15, leben: 3 },
  { gegner: 70, schutz: true,  schuss: 20, leben: 3 },
  { gegner: 80, schutz: true,  schuss: 25, leben: 3 },
  { gegner: 99, schutz: false, schuss: 40, leben: 1 }
];
const OPT_ITEMS  = ['Scoreboard', 'Game Difficulty', 'Zurück zum Hauptmenü'];
const DIFF_ITEMS = ['Easy', 'Normal', 'Hard', 'Expert', 'Nightmare', 'Zurück zu den Optionen'];

const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a)); // wie Random.Next(a, b)

/* ---------- Spielzustand ---------- */
let gegneranzahl = 50, schutz = true, schussanzahl = 7, livedif = 5, diffMark = 0;
let leben = 0, score = 0, gegner = 0, playerX = 28, inputX = 0;
let schuss = false, spiel = false;
let ufoAktiv = false, ufoBewegung = false, ufoTimer = 0;
let gegnerbewegung = false, gegnerdelay = 0, frame = 0;
let loop = null;
const grid = Array.from({ length: H }, () => Array(W).fill(' '));

/* ---------- Spiellogik ---------- */
function initSpiel() {
  playerX = 28;
  gegner = gegneranzahl;
  ufoAktiv = false;
  for (let r = 0; r < H; r++)
    for (let s = 0; s < W; s++)
      grid[r][s] = (r === 0 || r === H - 1 || s === 0 || s === W - 1) ? '█' : ' ';

  for (let k = 1; k <= gegneranzahl;) {
    const r = rnd(4, 11), s = rnd(4, 52);
    if (grid[r][s] !== '*') { grid[r][s] = '*'; k++; }
  }
  grid[PY][playerX] = 'P';

  if (schutz)
    for (const sx of SCHUTZ_X)
      for (let r = 0; r < SCHUTZ_H; r++)
        for (let s = 0; s < SCHUTZ_B; s++)
          grid[22 - r][sx + s] = '#';
}

const ENEMY_ROWS = [4, 5, 6, 7, 8, 9, 10, 11];

function update() {
  /* UFO spawn */
  if (!ufoAktiv && rnd(1, 1000) < 10 && ufoTimer > 70) {
    ufoAktiv = true;
    if (ufoBewegung) { grid[UFO_Y][52] = 'U'; ufoBewegung = false; }
    else             { grid[UFO_Y][4]  = 'U'; ufoBewegung = true; }
  } else {
    ufoTimer++;
  }

  /* UFO Bewegung (false = nach links, true = nach rechts) */
  if (ufoAktiv) {
    const row = grid[UFO_Y];
    if (!ufoBewegung) {
      if (row[1] !== 'U') {
        for (let s = 0; s < W; s++) {
          if (row[s] === 'U') {
            if (row[s - 1] === '|') {
              row[s - 1] = ' '; row[s] = ' ';
              score += rnd(100, 300); ufoAktiv = false; ufoTimer = 0;
            } else { row[s - 1] = 'U'; row[s] = ' '; }
          }
        }
      } else ufoBewegung = true;
    } else {
      if (row[55] !== 'U') {
        for (let s = W - 1; s > 0; s--) {
          if (row[s] === 'U') {
            if (row[s + 1] === '|') {
              row[s + 1] = ' '; row[s] = ' ';
              score += rnd(100, 300); ufoAktiv = false; ufoTimer = 0;
            } else { row[s + 1] = 'U'; row[s] = ' '; }
          }
        }
      } else ufoBewegung = false;
    }
  }

  /* Gegner-Schuss spawnen (unterster Gegner pro Spalte) */
  for (let s = 0; s < W; s++) {
    for (let r = H - 1; r >= 0; r--) {
      if (grid[r][s] === '*') {
        if (r + 1 < H && grid[r + 1][s] === ' ' && rnd(1, 1000) < schussanzahl)
          grid[r + 1][s] = 'v';
        break;
      }
    }
  }

  /* Gegner-Schuss bewegen */
  for (let r = H - 1; r >= 1; r--) {
    for (let s = W - 1; s >= 1; s--) {
      if (grid[r][s] !== 'v') continue;
      const below = r + 1 < H ? grid[r + 1][s] : '█';
      if (below === ' ')      { grid[r + 1][s] = 'v'; grid[r][s] = ' '; }
      else if (below === '#') { grid[r + 1][s] = ' '; grid[r][s] = ' '; }
      else if (below === 'P') { if (leben > 0) leben--; grid[r][s] = ' '; }
      else                    { grid[r][s] = ' '; }
    }
  }

  /* Spielerbewegung */
  const newX = playerX + inputX;
  if (newX - 2 >= 0 && newX + 2 < W) {
    grid[PY][playerX] = ' ';
    for (let d = -1; d <= 1; d++) grid[PY + 1][playerX + d] = ' ';
    playerX = newX;
    grid[PY][playerX] = 'P';
    for (let d = -1; d <= 1; d++) grid[PY + 1][playerX + d] = 'P';
  }
  inputX = 0;

  /* Spieler-Schuss spawnen */
  if (schuss && grid[PY - 1][playerX] === ' ' && grid[PY - 2][playerX] === ' ' &&
      grid[PY - 2][playerX - 1] !== '|' && grid[PY - 2][playerX + 1] !== '|')
    grid[PY - 1][playerX] = '|';
  schuss = false;

  /* Spieler-Schuss bewegen */
  for (let r = 1; r < H - 1; r++) {
    for (let s = 1; s < W - 1; s++) {
      if (grid[r][s] !== '|') continue;
      const up = grid[r - 1][s];
      if (up === '*')      { grid[r - 1][s] = ' '; grid[r][s] = ' '; gegner--; score += 10; }
      else if (up === 'v' || up === '#') { grid[r - 1][s] = ' '; grid[r][s] = ' '; }
      else if (up === 'U') {
        grid[r - 1][s] = ' '; grid[r][s] = ' ';
        score += rnd(100, 300); ufoAktiv = false; ufoTimer = 0;
      }
      else if (up === ' ') { grid[r - 1][s] = '|'; grid[r][s] = ' '; }
      else                 { grid[r][s] = ' '; }
    }
  }

  /* Gegnerbewegung (alle 3 Ticks, nur horizontal) */
  gegnerdelay++;
  if (gegnerdelay === 3) {
    frame ^= 1;
    if (!gegnerbewegung) {
      if (ENEMY_ROWS.every(r => grid[r][1] !== '*')) {
        for (let r = 0; r < H; r++)
          for (let s = 0; s < W; s++)
            if (grid[r][s] === '*') {
              if (grid[r][s - 1] === '|') { grid[r][s - 1] = ' '; grid[r][s] = ' '; gegner--; score += 10; }
              else { grid[r][s - 1] = '*'; grid[r][s] = ' '; }
            }
      } else gegnerbewegung = true;
    } else {
      if (ENEMY_ROWS.every(r => grid[r][55] !== '*')) {
        for (let r = 0; r < H; r++)
          for (let s = W - 1; s > 0; s--)
            if (grid[r][s] === '*') {
              if (grid[r][s + 1] === '|') { grid[r][s + 1] = ' '; grid[r][s] = ' '; gegner--; score += 10; }
              else { grid[r][s + 1] = '*'; grid[r][s] = ' '; }
            }
      } else gegnerbewegung = false;
    }
    gegnerdelay = 0;
  }
}

/* ---------- Zeichnen ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
const SPR = [
  ['..#.#..', '.#####.', '##.#.##', '#######', '#.#.#.#'],
  ['..#.#..', '#######', '##.#.##', '.#####.', '.#...#.']
];
const ROW_COLORS = ['#7cf5a8', '#7cf5a8', '#b4f06a', '#b4f06a', '#f5e46a', '#f5e46a', '#f5a46a'];

function render() {
  ctx.fillStyle = '#05080b';
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let r = 0; r < H; r++) {
    for (let s = 0; s < W; s++) {
      const c = grid[r][s];
      if (c === ' ') continue;
      const x = s * CW, y = r * CH;
      switch (c) {
        case '█':
          ctx.fillStyle = '#1d3347'; ctx.fillRect(x, y, CW, CH); break;
        case '*': {
          ctx.fillStyle = ROW_COLORS[r - 4] || '#7cf5a8';
          const sp = SPR[frame];
          for (let i = 0; i < 5; i++)
            for (let j = 0; j < 7; j++)
              if (sp[i][j] === '#') ctx.fillRect(x + 1 + j * 2, y + 2 + i * 3, 2, 3);
          break;
        }
        case 'P':
          ctx.fillStyle = '#58e6ff';
          if (r === PY) ctx.fillRect(x + 6, y + 2, 4, CH - 2);
          else ctx.fillRect(x, y + 2, CW, CH - 6);
          break;
        case '#':
          ctx.fillStyle = '#5fd68a'; ctx.fillRect(x + 1, y + 1, CW - 2, CH - 2); break;
        case 'v':
          ctx.fillStyle = '#ff5a5a'; ctx.fillRect(x + 6, y + 3, 4, 14); break;
        case '|':
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 7, y + 2, 2, CH - 4); break;
        case 'U':
          ctx.fillStyle = '#ff6ad5';
          ctx.beginPath(); ctx.ellipse(x + 8, y + 12, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 8, y + 10, 4, Math.PI, 0); ctx.fill();
          break;
      }
    }
  }
  $('hudLeben').innerHTML = '♥'.repeat(leben) + '<i>' + '♥'.repeat(Math.max(0, livedif - leben)) + '</i>';
  $('hudGegner').textContent = gegner;
  $('hudScore').textContent = score;
}

/* ---------- Eingabe ---------- */
const held = { l: false, r: false, f: false };
const tap  = { l: false, r: false, f: false };

function readInput() {
  inputX = ((held.r || tap.r) ? 1 : 0) - ((held.l || tap.l) ? 1 : 0);
  schuss = held.f || tap.f;
  tap.l = tap.r = tap.f = false;
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();

  if (screen === 'game') {
    if (k === 'ArrowLeft') held.l = tap.l = true;
    else if (k === 'ArrowRight') held.r = tap.r = true;
    else if (k === 'ArrowUp' || k === ' ') held.f = tap.f = true;
    else if (k === 'Escape') spiel = false;
  } else if (screen === 'menu') {
    if (k === 'Enter' && !e.repeat) startGame();
    else if (k === 'o' || k === 'O') show('options');
  } else if (screen === 'options' || screen === 'diff') {
    const n = screen === 'options' ? OPT_ITEMS.length : DIFF_ITEMS.length;
    if (k === 'ArrowUp') { sel = (sel + n - 1) % n; draw(); }
    else if (k === 'ArrowDown') { sel = (sel + 1) % n; draw(); }
    else if (k === 'Escape') { screen === 'options' ? show('menu') : show('options', 1); }
    else if ((k === 'Enter' || k === ' ') && !e.repeat) activate();
  } else if (screen === 'scores') {
    if (!e.repeat) show('options');
  } else if (screen === 'over' && saved) {
    if (k === 'Enter' && !e.repeat) show('menu');
  }
});

document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft') held.l = false;
  else if (e.key === 'ArrowRight') held.r = false;
  else if (e.key === 'ArrowUp' || e.key === ' ') held.f = false;
});
window.addEventListener('blur', () => { held.l = held.r = held.f = false; });

/* ---------- Menüs und Screens ---------- */
let screen = 'menu', sel = 0, saved = false;

function show(name, selIndex = 0) {
  screen = name; sel = selIndex;
  document.querySelectorAll('.screen').forEach(el => { el.hidden = el.id !== 'screen-' + name; });
  if (name === 'scores') drawScores(); else draw();
}

function draw() {
  if (screen === 'options') drawList($('optList'), OPT_ITEMS);
  else if (screen === 'diff') drawList($('diffList'), DIFF_ITEMS);
}

function drawList(ul, items) {
  ul.innerHTML = '';
  items.forEach((text, i) => {
    const li = document.createElement('li');
    li.textContent = text;
    if (i === sel) li.classList.add('sel');
    if (ul.id === 'diffList' && i === diffMark) li.classList.add('active');
    li.addEventListener('click', () => { sel = i; activate(); });
    ul.appendChild(li);
  });
}

function activate() {
  if (screen === 'options') {
    if (sel === 0) show('scores');
    else if (sel === 1) show('diff');
    else show('menu');
  } else if (screen === 'diff') {
    if (sel === 5) { show('options', 1); return; }
    const d = DIFFS[sel];
    gegneranzahl = d.gegner; schutz = d.schutz; schussanzahl = d.schuss;
    livedif = d.leben; diffMark = sel;
    draw();
  }
}

/* ---------- Scoreboard (bleibt im Browser gespeichert) ---------- */
const KEY = 'spaceinvaders.scoreboard';
let board = [];
try { board = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { board = []; }
if (!Array.isArray(board)) board = [];
function saveBoard() { try { localStorage.setItem(KEY, JSON.stringify(board)); } catch (_) {} }

function drawScores() {
  const box = $('scoreList');
  box.innerHTML = '';
  if (!board.length) { box.innerHTML = '<div><span>Noch keine Einträge.</span></div>'; return; }
  [...board].sort((a, b) => b.score - a.score).forEach(e => {
    const row = document.createElement('div');
    const n = document.createElement('span'), p = document.createElement('span');
    n.textContent = e.name; p.textContent = e.score;
    row.append(n, p); box.appendChild(row);
  });
}

/* ---------- Spielablauf ---------- */
function startGame() {
  if (screen === 'game') return;
  leben = livedif; score = 0; ufoTimer = 0; spiel = true;
  held.l = held.r = held.f = false; tap.l = tap.r = tap.f = false;
  show('game');
  initSpiel();
  render();
  loop = setInterval(tick, 50);
}

function tick() {
  if (leben === 0) spiel = false;
  if (leben > 0 && gegner === 0) initSpiel();
  readInput();
  update();
  render();
  if (!spiel) { clearInterval(loop); gameOver(); }
}

function gameOver() {
  saved = false;
  show('over');
  $('finalScore').textContent = score;
  $('nameForm').hidden = false;
  $('savedBox').hidden = true;
  $('nameErr').textContent = '';
  $('nameInput').value = '';
  $('nameInput').focus();
}

$('nameForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('nameInput').value.trim();
  if (name.length < 1 || name.length > 15) {
    $('nameErr').textContent = 'Gib einen gültigen Namen ein (1 bis 15 Zeichen).';
    return;
  }
  board.push({ name, score });
  saveBoard();
  saved = true;
  $('nameForm').hidden = true;
  $('savedBox').hidden = false;
  $('btnToMenu').focus();
});

$('btnStart').addEventListener('click', startGame);
$('btnOptions').addEventListener('click', () => show('options'));
$('btnScoresBack').addEventListener('click', () => show('options'));
$('btnToMenu').addEventListener('click', () => show('menu'));

show('menu');
})();
