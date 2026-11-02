const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best-score');
const speedEl = document.getElementById('speed');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const controlButtons = Array.from(document.querySelectorAll('[data-dir]'));

const GRID_SIZE = 20;
const CELL_SIZE = canvas.width / GRID_SIZE;
const INITIAL_TICK_MS = 170;
const MIN_TICK_MS = 75;
const SPEED_STEP = 7;

const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let snake;
let direction;
let queuedDirection;
let food;
let obstacles;
let score;
let bestScore;
let tickMs;
let lastMove;
let isPlaying;
let isPaused;

const storageKey = 'snake-rush-best-score';

function resetOverlayText() {
  const title = overlay.querySelector('h1');
  const description = overlay.querySelector('p');
  if (title) {
    title.textContent = 'Snake Rush';
  }
  if (description) {
    description.textContent = 'Use arrow keys or WASD to move. Collect fruit, avoid walls, and don’t crash into yourself.';
  }
  startButton.textContent = 'Play Now';
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function loadBestScore() {
  const stored = Number.parseInt(localStorage.getItem(storageKey) || '0', 10);
  bestScore = Number.isFinite(stored) ? stored : 0;
  bestEl.textContent = String(bestScore);
}

function resetGame() {
  snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ];
  direction = directions.right;
  queuedDirection = directions.right;
  obstacles = generateObstacles();
  food = randomFood();
  score = 0;
  tickMs = INITIAL_TICK_MS;
  lastMove = 0;
  isPaused = false;
  pauseButton.textContent = 'Pause';
  updateHud();
}

function startGame() {
  resetOverlayText();
  resetGame();
  isPlaying = true;
  overlay.classList.remove('visible');
  requestAnimationFrame(gameLoop);
}

function endGame() {
  isPlaying = false;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(storageKey, String(bestScore));
    bestEl.textContent = String(bestScore);
  }
  overlay.classList.add('visible');
  overlay.querySelector('h1').textContent = 'Game Over';
  overlay.querySelector('p').textContent = `Final score: ${score}. Press the button below to play again.`;
  startButton.textContent = 'Play Again';
}

function setPaused(nextPaused) {
  if (!isPlaying) {
    return;
  }
  isPaused = nextPaused;
  pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
}

function setDirection(nextDirection) {
  if (!isPlaying) {
    return;
  }

  const isOpposite =
    nextDirection.x === -direction.x && nextDirection.y === -direction.y;

  if (!isOpposite) {
    queuedDirection = nextDirection;
  }
}

function generateObstacles() {
  const list = new Set();
  const count = 8;

  while (list.size < count) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    const isNearStart = (x >= 5 && x <= 11 && y >= 9 && y <= 11);

    if (!isNearStart) {
      list.add(`${x},${y}`);
    }
  }

  return [...list].map((entry) => {
    const [x, y] = entry.split(',').map(Number);
    return { x, y };
  });
}

function isOccupied(cell, ignoreTail = false) {
  if (obstacles.some((obstacle) => obstacle.x === cell.x && obstacle.y === cell.y)) {
    return true;
  }

  for (let index = 0; index < snake.length; index += 1) {
    const part = snake[index];
    const shouldIgnore = ignoreTail && index === snake.length - 1 && !foodIsConsumed(cell);
    if (shouldIgnore) {
      continue;
    }
    if (part.x === cell.x && part.y === cell.y) {
      return true;
    }
  }

  return false;
}

function foodIsConsumed(cell) {
  return food && cell.x === food.x && cell.y === food.y;
}

function randomFood() {
  let candidate;
  let attempts = 0;

  do {
    candidate = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
    attempts += 1;
  } while ((isOccupied(candidate, false) || attempts < 200) && attempts < 300);

  return candidate;
}

function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(bestScore);
  speedEl.textContent = `${(INITIAL_TICK_MS / tickMs).toFixed(1)}x`;
}

function stepGame() {
  direction = queuedDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  if (
    head.x < 0 ||
    head.x >= GRID_SIZE ||
    head.y < 0 ||
    head.y >= GRID_SIZE ||
    isOccupied(head, true)
  ) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    tickMs = clamp(INITIAL_TICK_MS - score * 0.8, MIN_TICK_MS, INITIAL_TICK_MS);
    food = randomFood();
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(storageKey, String(bestScore));
    }
  } else {
    snake.pop();
  }

  updateHud();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#081924';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < GRID_SIZE; x += 1) {
    for (let y = 0; y < GRID_SIZE; y += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  obstacles.forEach((cell) => {
    ctx.fillStyle = '#405c7a';
    ctx.fillRect(cell.x * CELL_SIZE + 2, cell.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
  });

  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.arc(food.x * CELL_SIZE + CELL_SIZE / 2, food.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE * 0.34, 0, Math.PI * 2);
  ctx.fill();

  snake.forEach((segment, index) => {
    const x = segment.x * CELL_SIZE;
    const y = segment.y * CELL_SIZE;

    ctx.fillStyle = index === 0 ? '#7ef1a3' : '#4cc36b';
    ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

    if (index === 0) {
      ctx.fillStyle = '#0d2c24';
      ctx.fillRect(x + CELL_SIZE * 0.55, y + CELL_SIZE * 0.3, CELL_SIZE * 0.18, CELL_SIZE * 0.18);
      ctx.fillRect(x + CELL_SIZE * 0.25, y + CELL_SIZE * 0.3, CELL_SIZE * 0.18, CELL_SIZE * 0.18);
    }
  });
}

function gameLoop(timestamp) {
  if (isPlaying && !isPaused && timestamp - lastMove >= tickMs) {
    stepGame();
    lastMove = timestamp;
  }

  drawBoard();

  if (isPlaying) {
    requestAnimationFrame(gameLoop);
  }
}

function handleDirectionInput(directionName) {
  if (!isPlaying && directionName) {
    startGame();
  }
  if (isPlaying) {
    setDirection(directions[directionName]);
  }
}

startButton.addEventListener('click', () => {
  overlay.classList.remove('visible');
  startGame();
});

pauseButton.addEventListener('click', () => {
  if (!isPlaying) {
    startGame();
    return;
  }
  setPaused(!isPaused);
});

controlButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const directionName = button.dataset.dir;
    handleDirectionInput(directionName);
  });
});

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const map = {
    arrowup: 'up',
    w: 'up',
    arrowdown: 'down',
    s: 'down',
    arrowleft: 'left',
    a: 'left',
    arrowright: 'right',
    d: 'right',
    ' ': 'pause',
  };

  const directionName = map[key];

  if (!directionName) {
    return;
  }

  event.preventDefault();

  if (directionName === 'pause') {
    pauseButton.click();
    return;
  }

  if (!isPlaying) {
    startGame();
  }

  setDirection(directions[directionName]);
});

loadBestScore();
resetGame();
drawBoard();
