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

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const gameState = {
  players: new Map(),
  gameArea: {
    width: 800,
    height: 600,
    shrinkRate: 0.1 // pixels per second
  },
  gameStatus: 'waiting', // waiting, playing, ended
  lastUpdate: Date.now()
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
        body: [{x: Math.random() * 700 + 50, y: Math.random() * 500 + 50}],
        direction: { x: 1, y: 0 },
        color: `hsl(${Math.random() * 360}, 70%, 50%)`
      },
      score: 0,
      alive: true
    };
    
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

  // Player disconnects
  socket.on('disconnect', () => {
    gameState.players.delete(socket.id);
    socket.broadcast.emit('playerLeft', socket.id);
    console.log('Player disconnected:', socket.id);
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
    gameStatus: gameState.gameStatus
  });
}

function updateSnake(snake, deltaTime) {
  const speed = 100; // pixels per second
  const head = snake.body[0];
  const newHead = {
    x: head.x + snake.direction.x * speed * deltaTime,
    y: head.y + snake.direction.y * speed * deltaTime
  };
  
  snake.body.unshift(newHead);
  
  // Keep snake length constant for now (can add growth mechanics later)
  if (snake.body.length > 10) {
    snake.body.pop();
  }
}

function checkCollisions(player) {
  const snake = player.snake;
  const head = snake.body[0];
  
  // Check wall collision
  if (head.x < 0 || head.x > gameState.gameArea.width || 
      head.y < 0 || head.y > gameState.gameArea.height) {
    player.alive = false;
    return;
  }
  
  // Check self collision
  for (let i = 4; i < snake.body.length; i++) {
    if (Math.abs(head.x - snake.body[i].x) < 10 && 
        Math.abs(head.y - snake.body[i].y) < 10) {
      player.alive = false;
      return;
    }
  }
  
  // Check collision with other snakes
  gameState.players.forEach((otherPlayer) => {
    if (otherPlayer.id !== player.id && otherPlayer.alive) {
      otherPlayer.snake.body.forEach((segment) => {
        if (Math.abs(head.x - segment.x) < 10 && 
            Math.abs(head.y - segment.y) < 10) {
          player.alive = false;
        }
      });
    }
  });
}

// Start game loop
setInterval(gameLoop, 1000 / 60); // 60 FPS

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Snake Royale server running on port ${PORT}`);
});