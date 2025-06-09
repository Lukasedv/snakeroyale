const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Version info for CI/CD testing
const VERSION = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0, 7) : 'dev';
console.log(`🐍 Snake Royale starting - Version: ${VERSION}`);

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/spectator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spectator.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spectator.html'));
});

// API endpoint for version info
app.get('/api/version', (req, res) => {
  res.json({ 
    version: VERSION,
    timestamp: new Date().toISOString(),
    region: 'Sweden Central'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    players: gameState.players.size,
    spectators: gameState.spectators.size,
    gameStatus: gameState.gameStatus,
    uptime: process.uptime()
  });
});

// Game state
const gameState = {
  players: new Map(),
  spectators: new Set(),
  gameArea: {
    width: 800,
    height: 600,
    shrinkRate: 0.1 // pixels per second
  },
  gameStatus: 'waiting', // waiting, playing, ended
  lastUpdate: Date.now(),
  round: 1
};

// Socket handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Player joins game
  socket.on('joinGame', (playerData) => {
    const player = {
      id: socket.id,
      name: playerData.name || `Player${Math.floor(Math.random() * 1000)}`,
      snake: {
        body: [{
          x: Math.random() * (gameState.gameArea.width - 100) + 50, 
          y: Math.random() * (gameState.gameArea.height - 100) + 50
        }],
        direction: { x: 1, y: 0 },
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        length: 5 // Starting length
      },
      score: 0,
      alive: true,
      joinTime: Date.now()
    };
    
    // Initialize snake body with starting length
    for (let i = 1; i < player.snake.length; i++) {
      player.snake.body.push({
        x: player.snake.body[0].x - i * 10,
        y: player.snake.body[0].y
      });
    }
    
    gameState.players.set(socket.id, player);
    socket.emit('gameJoined', { playerId: socket.id, gameState });
    socket.broadcast.emit('playerJoined', player);
    
    console.log(`Player ${player.name} joined. Total players: ${gameState.players.size}`);
  });

  // Handle player movement
  socket.on('changeDirection', (direction) => {
    const player = gameState.players.get(socket.id);
    if (player && player.alive) {
      // Prevent reversing into self
      const currentDir = player.snake.direction;
      if ((direction.x !== 0 && currentDir.x === 0) || 
          (direction.y !== 0 && currentDir.y === 0)) {
        player.snake.direction = direction;
      }
    }
  });

  // Spectator joins
  socket.on('joinSpectator', () => {
    gameState.spectators.add(socket.id);
    socket.emit('gameJoined', { playerId: null, gameState });
    console.log(`Spectator joined. Socket ID: ${socket.id}`);
  });

  // Admin controls
  socket.on('adminRestart', () => {
    console.log('Admin restart requested');
    restartGame();
    io.emit('gameRestarted');
  });

  socket.on('adminPause', () => {
    console.log('Admin pause requested');
    gameState.gameStatus = gameState.gameStatus === 'playing' ? 'paused' : 'playing';
  });

  socket.on('adminClearPlayers', () => {
    console.log('Admin clear players requested');
    gameState.players.clear();
    io.emit('playersCleared');
  });

  // Player disconnects
  socket.on('disconnect', () => {
    if (gameState.players.has(socket.id)) {
      gameState.players.delete(socket.id);
      socket.broadcast.emit('playerLeft', socket.id);
      console.log('Player disconnected:', socket.id);
    } else if (gameState.spectators.has(socket.id)) {
      gameState.spectators.delete(socket.id);
      console.log('Spectator disconnected:', socket.id);
    }
  });
});

// Game loop
function gameLoop() {
  const now = Date.now();
  const deltaTime = (now - gameState.lastUpdate) / 1000;
  gameState.lastUpdate = now;

  if (gameState.gameStatus === 'playing') {
    // Update all snakes
    gameState.players.forEach((player) => {
      if (player.alive) {
        updateSnake(player.snake, deltaTime);
        checkCollisions(player);
      }
    });

    // Check win condition
    const alivePlayers = Array.from(gameState.players.values()).filter(p => p.alive);
    if (alivePlayers.length <= 1) {
      gameState.gameStatus = 'ended';
      io.emit('gameEnded', { winner: alivePlayers[0] || null });
    }
  }

  // Start game if enough players
  if (gameState.gameStatus === 'waiting' && gameState.players.size >= 2) {
    gameState.gameStatus = 'playing';
    io.emit('gameStarted');
  }

  // Broadcast game state
  io.emit('gameUpdate', {
    players: Array.from(gameState.players.values()),
    gameArea: gameState.gameArea,
    gameStatus: gameState.gameStatus,
    round: gameState.round
  });
}

function restartGame() {
  gameState.players.clear();
  gameState.gameStatus = 'waiting';
  gameState.round++;
  gameState.lastUpdate = Date.now();
  console.log(`Game restarted. Round ${gameState.round}`);
}

function updateSnake(snake, deltaTime) {
  const speed = 80; // pixels per second
  const head = snake.body[0];
  const newHead = {
    x: head.x + snake.direction.x * speed * deltaTime,
    y: head.y + snake.direction.y * speed * deltaTime
  };
  
  snake.body.unshift(newHead);
  
  // Maintain snake length - remove tail if too long
  while (snake.body.length > snake.length) {
    snake.body.pop();
  }
}

function checkCollisions(player) {
  const snake = player.snake;
  const head = snake.body[0];
  
  // Check wall collision
  if (head.x < 10 || head.x > gameState.gameArea.width - 10 || 
      head.y < 10 || head.y > gameState.gameArea.height - 10) {
    player.alive = false;
    console.log(`Player ${player.name} hit wall`);
    return;
  }
  
  // Check self collision (skip first few segments to allow turning)
  for (let i = 8; i < snake.body.length; i++) {
    if (Math.abs(head.x - snake.body[i].x) < 8 && 
        Math.abs(head.y - snake.body[i].y) < 8) {
      player.alive = false;
      console.log(`Player ${player.name} hit themselves`);
      return;
    }
  }
  
  // Check collision with other snakes
  gameState.players.forEach((otherPlayer) => {
    if (otherPlayer.id !== player.id && otherPlayer.alive) {
      otherPlayer.snake.body.forEach((segment, index) => {
        if (Math.abs(head.x - segment.x) < 12 && 
            Math.abs(head.y - segment.y) < 12) {
          player.alive = false;
          
          // Award points to the other player if they killed someone with their head
          if (index === 0) {
            otherPlayer.score += 10;
            console.log(`Player ${otherPlayer.name} eliminated ${player.name}`);
          } else {
            console.log(`Player ${player.name} hit ${otherPlayer.name}'s body`);
          }
        }
      });
    }
  });
  
  // Award survival points over time
  if (player.alive) {
    const survivalTime = Date.now() - player.joinTime;
    player.score = Math.floor(survivalTime / 1000); // 1 point per second of survival
  }
}

// Start game loop
setInterval(gameLoop, 1000 / 60); // 60 FPS

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Snake Royale server running on port ${PORT}`);
});