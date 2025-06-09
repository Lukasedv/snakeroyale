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
    npcs: gameState.npcs.size,
    spectators: gameState.spectators.size,
    gameStatus: gameState.gameStatus,
    uptime: process.uptime()
  });
});

// Collision detection constants - standardized across all functions
const COLLISION_CONSTANTS = {
  SNAKE_COLLISION_THRESHOLD: 12,  // Distance for snake-to-snake collisions
  FOOD_COLLISION_THRESHOLD: 15,   // Distance for snake-to-food collisions
  WALL_MARGIN: 15,                // Distance from walls for safety checks
  SELF_COLLISION_SKIP_SEGMENTS: 8 // Number of head segments to skip for self-collision
};

// Game state
const gameState = {
  players: new Map(),
  npcs: new Map(),
  spectators: new Set(),
  food: [],
  gameArea: {
    width: 800,
    height: 600,
    shrinkRate: 0.1 // pixels per second
  },
  gameStatus: 'waiting', // waiting, playing, ended
  lastUpdate: Date.now(),
  round: 1,
  restartScheduled: false // Prevent multiple restart timers
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
      foodScore: 0,
      killScore: 0,
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
    gameState.npcs.clear(); // Also clear NPCs
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

  // Manage NPCs based on player count
  manageNPCs();

  if (gameState.gameStatus === 'playing') {
    // Spawn food periodically
    spawnFood();
    
    // Update all human players
    gameState.players.forEach((player) => {
      if (player.alive) {
        updateSnake(player.snake, deltaTime);
        checkCollisions(player);
      }
    });
    
    // Update all NPCs
    gameState.npcs.forEach((npc) => {
      if (npc.alive) {
        updateNPCAI(npc, deltaTime);
        updateSnake(npc.snake, deltaTime);
        checkCollisions(npc);
      }
    });

    // Check win condition - count all alive entities
    const aliveHumans = Array.from(gameState.players.values()).filter(p => p.alive);
    const aliveNPCs = Array.from(gameState.npcs.values()).filter(p => p.alive);
    const totalAlive = aliveHumans.length + aliveNPCs.length;
    
    if (totalAlive <= 1 && !gameState.restartScheduled) {
      const winner = aliveHumans[0] || aliveNPCs[0] || null;
      io.emit('gameEnded', { winner });
      
      gameState.gameStatus = 'ended'; // Temporary state during restart delay
      gameState.restartScheduled = true;
      
      // Auto-restart the game after a brief delay to keep it ongoing
      setTimeout(() => {
        restartGame();
        io.emit('gameRestarted');
        console.log('Game auto-restarted after round completion');
      }, 3000); // 3 second delay to show the winner
    }
  }

  // Start game if enough players (humans + NPCs)
  const totalPlayers = gameState.players.size + gameState.npcs.size;
  if (gameState.gameStatus === 'waiting' && totalPlayers >= 2) {
    gameState.gameStatus = 'playing';
    io.emit('gameStarted');
  }

  // Broadcast game state (combine humans and NPCs)
  const allPlayers = [
    ...Array.from(gameState.players.values()),
    ...Array.from(gameState.npcs.values())
  ];
  
  io.emit('gameUpdate', {
    players: allPlayers,
    food: gameState.food,
    gameArea: gameState.gameArea,
    gameStatus: gameState.gameStatus,
    round: gameState.round
  });
}

function restartGame() {
  gameState.players.clear();
  gameState.npcs.clear(); // Clear all NPCs
  gameState.food = []; // Clear all food
  gameState.gameStatus = 'waiting';
  gameState.restartScheduled = false; // Reset restart flag
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

function createNPC(id) {
  const npc = {
    id: `npc_${id}`,
    name: `Bot${id}`,
    isNPC: true,
    snake: {
      body: [{
        x: Math.random() * (gameState.gameArea.width - 100) + 50, 
        y: Math.random() * (gameState.gameArea.height - 100) + 50
      }],
      direction: { x: 1, y: 0 },
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      length: 5
    },
    score: 0,
    foodScore: 0,
    killScore: 0,
    alive: true,
    joinTime: Date.now(),
    lastDirectionChange: Date.now(),
    targetFood: null
  };
  
  // Initialize snake body
  for (let i = 1; i < npc.snake.length; i++) {
    npc.snake.body.push({
      x: npc.snake.body[0].x - i * 10,
      y: npc.snake.body[0].y
    });
  }
  
  return npc;
}

function manageNPCs() {
  const humanPlayers = Array.from(gameState.players.values()).length;
  const currentNPCs = gameState.npcs.size;
  
  // If only 1 human player, ensure we have 2 NPCs
  if (humanPlayers === 1 && currentNPCs < 2) {
    for (let i = currentNPCs; i < 2; i++) {
      const npc = createNPC(i + 1);
      gameState.npcs.set(npc.id, npc);
      console.log(`NPC ${npc.name} joined for single player mode`);
    }
  }
  
  // If 2+ human players, remove all NPCs
  if (humanPlayers >= 2 && currentNPCs > 0) {
    gameState.npcs.clear();
    console.log('NPCs removed - multiplayer mode');
  }
}

function updateNPCAI(npc, deltaTime) {
  const head = npc.snake.body[0];
  const now = Date.now();
  
  // Change direction every 1-3 seconds or when approaching danger
  const shouldChangeDirection = 
    (now - npc.lastDirectionChange > Math.random() * 2000 + 1000) ||
    willHitWall(npc) || 
    willHitSnake(npc);
  
  if (shouldChangeDirection) {
    // Try to find food to target
    if (!npc.targetFood || !gameState.food.find(f => f.id === npc.targetFood)) {
      npc.targetFood = findNearestFood(npc);
    }
    
    // Get safe directions
    const safeDirections = getSafeDirections(npc);
    
    if (safeDirections.length > 0) {
      let newDirection;
      
      // If we have a food target, try to move towards it
      if (npc.targetFood && safeDirections.length > 1) {
        const food = gameState.food.find(f => f.id === npc.targetFood);
        if (food) {
          newDirection = getDirectionTowardsFood(npc, food, safeDirections);
        }
      }
      
      // If no food direction or single safe direction, pick randomly
      if (!newDirection) {
        newDirection = safeDirections[Math.floor(Math.random() * safeDirections.length)];
      }
      
      npc.snake.direction = newDirection;
      npc.lastDirectionChange = now;
    }
  }
}

function willHitWall(npc) {
  const head = npc.snake.body[0];
  const dir = npc.snake.direction;
  const nextX = head.x + dir.x * 40; // Look ahead 40 pixels
  const nextY = head.y + dir.y * 40;
  
  return nextX < COLLISION_CONSTANTS.WALL_MARGIN || nextX > gameState.gameArea.width - COLLISION_CONSTANTS.WALL_MARGIN || 
         nextY < COLLISION_CONSTANTS.WALL_MARGIN || nextY > gameState.gameArea.height - COLLISION_CONSTANTS.WALL_MARGIN;
}

function willHitSnake(npc) {
  const head = npc.snake.body[0];
  const dir = npc.snake.direction;
  const nextX = head.x + dir.x * 30; // Look ahead 30 pixels
  const nextY = head.y + dir.y * 30;
  
  // Check collision with self (skip first segments to match actual collision detection)
  for (let i = COLLISION_CONSTANTS.SELF_COLLISION_SKIP_SEGMENTS; i < npc.snake.body.length; i++) {
    const segment = npc.snake.body[i];
    if (Math.abs(nextX - segment.x) < COLLISION_CONSTANTS.SNAKE_COLLISION_THRESHOLD && 
        Math.abs(nextY - segment.y) < COLLISION_CONSTANTS.SNAKE_COLLISION_THRESHOLD) {
      return true;
    }
  }
  
  // Check collision with other snakes
  const allSnakes = [...gameState.players.values(), ...gameState.npcs.values()];
  for (const other of allSnakes) {
    if (other.id !== npc.id && other.alive) {
      for (const segment of other.snake.body) {
        if (Math.abs(nextX - segment.x) < COLLISION_CONSTANTS.SNAKE_COLLISION_THRESHOLD && 
            Math.abs(nextY - segment.y) < COLLISION_CONSTANTS.SNAKE_COLLISION_THRESHOLD) {
          return true;
        }
      }
    }
  }
  
  return false;
}

function getSafeDirections(npc) {
  const directions = [
    { x: 0, y: -1 }, // Up
    { x: 0, y: 1 },  // Down
    { x: -1, y: 0 }, // Left
    { x: 1, y: 0 }   // Right
  ];
  
  const currentDir = npc.snake.direction;
  
  return directions.filter(dir => {
    // Don't reverse direction
    if (dir.x === -currentDir.x && dir.y === -currentDir.y) return false;
    
    // Test if this direction is safe
    const head = npc.snake.body[0];
    const testX = head.x + dir.x * 30;
    const testY = head.y + dir.y * 30;
    
    // Check walls - use same margin as actual collision detection
    if (testX < COLLISION_CONSTANTS.WALL_MARGIN || testX > gameState.gameArea.width - COLLISION_CONSTANTS.WALL_MARGIN || 
        testY < COLLISION_CONSTANTS.WALL_MARGIN || testY > gameState.gameArea.height - COLLISION_CONSTANTS.WALL_MARGIN) {
      return false;
    }
    
    // Check snake collisions
    const allSnakes = [...gameState.players.values(), ...gameState.npcs.values()];
    for (const other of allSnakes) {
      if (other.alive) {
        for (let i = (other.id === npc.id ? COLLISION_CONSTANTS.SELF_COLLISION_SKIP_SEGMENTS : 0); i < other.snake.body.length; i++) {
          const segment = other.snake.body[i];
          if (Math.abs(testX - segment.x) < COLLISION_CONSTANTS.SNAKE_COLLISION_THRESHOLD && 
              Math.abs(testY - segment.y) < COLLISION_CONSTANTS.SNAKE_COLLISION_THRESHOLD) {
            return false;
          }
        }
      }
    }
    
    return true;
  });
}

function findNearestFood(npc) {
  if (gameState.food.length === 0) return null;
  
  const head = npc.snake.body[0];
  let nearest = null;
  let minDistance = Infinity;
  
  for (const food of gameState.food) {
    const distance = Math.sqrt(Math.pow(head.x - food.x, 2) + Math.pow(head.y - food.y, 2));
    if (distance < minDistance) {
      minDistance = distance;
      nearest = food.id;
    }
  }
  
  return nearest;
}

function getDirectionTowardsFood(npc, food, safeDirections) {
  const head = npc.snake.body[0];
  const dx = food.x - head.x;
  const dy = food.y - head.y;
  
  // Prefer the direction that gets us closer to food
  let bestDirection = null;
  let bestScore = -Infinity;
  
  for (const dir of safeDirections) {
    // Calculate how much this direction helps us approach the food
    const score = dx * dir.x + dy * dir.y;
    if (score > bestScore) {
      bestScore = score;
      bestDirection = dir;
    }
  }
  
  return bestDirection;
}

function spawnFood() {
  const maxFood = 5; // Maximum number of food items on screen
  
  while (gameState.food.length < maxFood) {
    const food = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * (gameState.gameArea.width - 60) + 30,
      y: Math.random() * (gameState.gameArea.height - 60) + 30,
      value: 5 // Points awarded for eating this food
    };
    
    // Check if food spawns too close to any snake
    let tooClose = false;
    const allSnakes = [...gameState.players.values(), ...gameState.npcs.values()];
    
    for (const player of allSnakes) {
      if (player.alive) {
        for (const segment of player.snake.body) {
          if (Math.abs(food.x - segment.x) < COLLISION_CONSTANTS.FOOD_COLLISION_THRESHOLD + 10 && 
              Math.abs(food.y - segment.y) < COLLISION_CONSTANTS.FOOD_COLLISION_THRESHOLD + 10) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) break;
      }
    }
    
    if (!tooClose) {
      gameState.food.push(food);
    }
  }
}

function checkCollisions(player) {
  const snake = player.snake;
  const head = snake.body[0];
  
  // Check wall collision - use same margin as prediction functions
  if (head.x < COLLISION_CONSTANTS.WALL_MARGIN || head.x > gameState.gameArea.width - COLLISION_CONSTANTS.WALL_MARGIN || 
      head.y < COLLISION_CONSTANTS.WALL_MARGIN || head.y > gameState.gameArea.height - COLLISION_CONSTANTS.WALL_MARGIN) {
    player.alive = false;
    console.log(`${player.isNPC ? 'NPC' : 'Player'} ${player.name} hit wall`);
    return;
  }
  
  // Check self collision (skip first few segments to allow turning)
  for (let i = COLLISION_CONSTANTS.SELF_COLLISION_SKIP_SEGMENTS; i < snake.body.length; i++) {
    if (Math.abs(head.x - snake.body[i].x) < COLLISION_CONSTANTS.SNAKE_COLLISION_THRESHOLD && 
        Math.abs(head.y - snake.body[i].y) < COLLISION_CONSTANTS.SNAKE_COLLISION_THRESHOLD) {
      player.alive = false;
      console.log(`${player.isNPC ? 'NPC' : 'Player'} ${player.name} hit themselves`);
      return;
    }
  }
  
  // Check food collision
  gameState.food.forEach((food, index) => {
    if (Math.abs(head.x - food.x) < COLLISION_CONSTANTS.FOOD_COLLISION_THRESHOLD && 
        Math.abs(head.y - food.y) < COLLISION_CONSTANTS.FOOD_COLLISION_THRESHOLD) {
      // Player ate food
      player.foodScore = (player.foodScore || 0) + food.value;
      player.snake.length += 3; // Grow snake
      gameState.food.splice(index, 1); // Remove eaten food
      if (player.isNPC && player.targetFood === food.id) {
        player.targetFood = null; // Clear target
      }
      console.log(`${player.isNPC ? 'NPC' : 'Player'} ${player.name} ate food, food score: ${player.foodScore}`);
    }
  });
  
  // Check collision with other snakes
  const allOtherSnakes = [
    ...Array.from(gameState.players.values()),
    ...Array.from(gameState.npcs.values())
  ].filter(other => other.id !== player.id);
  
  allOtherSnakes.forEach((otherPlayer) => {
    if (otherPlayer.alive) {
      otherPlayer.snake.body.forEach((segment, index) => {
        if (Math.abs(head.x - segment.x) < COLLISION_CONSTANTS.SNAKE_COLLISION_THRESHOLD && 
            Math.abs(head.y - segment.y) < COLLISION_CONSTANTS.SNAKE_COLLISION_THRESHOLD) {
          player.alive = false;
          
          // Award points to the other player if they killed someone with their head
          if (index === 0) {
            otherPlayer.killScore = (otherPlayer.killScore || 0) + 10;
            console.log(`${otherPlayer.isNPC ? 'NPC' : 'Player'} ${otherPlayer.name} eliminated ${player.isNPC ? 'NPC' : 'Player'} ${player.name}`);
          } else {
            console.log(`${player.isNPC ? 'NPC' : 'Player'} ${player.name} hit ${otherPlayer.isNPC ? 'NPC' : 'Player'} ${otherPlayer.name}'s body`);
          }
        }
      });
    }
  });
  
  // Award survival points over time
  if (player.alive) {
    const survivalTime = Date.now() - player.joinTime;
    const survivalPoints = Math.floor(survivalTime / 1000);
    const foodPoints = player.foodScore || 0;
    const killPoints = player.killScore || 0;
    player.score = survivalPoints + foodPoints + killPoints;
  }
}

// Start game loop
setInterval(gameLoop, 1000 / 60); // 60 FPS

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Snake Royale server running on port ${PORT}`);
});