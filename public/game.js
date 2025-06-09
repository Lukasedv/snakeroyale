// Game client logic
class SnakeRoyaleGame {
    constructor() {
        this.socket = io();
        this.canvas = null;
        this.ctx = null;
        this.playerId = null;
        this.gameState = null;
        this.lastDirection = { x: 1, y: 0 };
        this.respawnTimer = null;
        this.deathTime = null;
        this.wasAlive = null; // Track previous alive state - initialize to null
        
        this.initializeSocket();
        this.setupKeyboardControls();
        this.setupTouchControls();
    }
    
    initializeSocket() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        this.socket.on('gameJoined', (data) => {
            this.playerId = data.playerId;
            this.gameState = data.gameState;
            this.showGameScreen();
        });
        
        this.socket.on('gameUpdate', (gameState) => {
            this.gameState = gameState;
            this.updateUI();
            this.render();
        });
        
        this.socket.on('gameStarted', () => {
            this.updateStatus('Game Started! Battle!');
        });
        
        this.socket.on('gameEnded', (data) => {
            if (data.winner) {
                this.updateStatus(`Game Over! Winner: ${data.winner.name}`);
            } else {
                this.updateStatus('Game Over! No winner.');
            }
        });
        
        this.socket.on('playerJoined', (player) => {
            console.log('Player joined:', player.name);
        });
        
        this.socket.on('playerLeft', (playerId) => {
            console.log('Player left:', playerId);
        });
        
        this.socket.on('respawnSuccessful', () => {
            console.log('Respawn successful');
            this.deathTime = null;
            this.hideRespawnUI();
        });
        
        this.socket.on('respawnDenied', (data) => {
            console.log(`Respawn denied, wait ${data.remainingTime} more seconds`);
        });
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            switch(event.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    this.changeDirection(0, -1);
                    event.preventDefault();
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    this.changeDirection(0, 1);
                    event.preventDefault();
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    this.changeDirection(-1, 0);
                    event.preventDefault();
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    this.changeDirection(1, 0);
                    event.preventDefault();
                    break;
            }
        });
    }
    
    setupTouchControls() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        const minSwipeDistance = 30; // Minimum distance for a swipe to register
        
        // Add touch event listeners to the document for global swipe detection
        document.addEventListener('touchstart', (event) => {
            touchStartX = event.changedTouches[0].screenX;
            touchStartY = event.changedTouches[0].screenY;
        }, { passive: true });
        
        document.addEventListener('touchend', (event) => {
            touchEndX = event.changedTouches[0].screenX;
            touchEndY = event.changedTouches[0].screenY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);
            
            // Only process swipe if it's long enough and the game is active
            if (this.canvas && (absDeltaX > minSwipeDistance || absDeltaY > minSwipeDistance)) {
                // Determine swipe direction (prioritize the axis with larger movement)
                if (absDeltaX > absDeltaY) {
                    // Horizontal swipe
                    if (deltaX > 0) {
                        this.changeDirection(1, 0); // Right
                    } else {
                        this.changeDirection(-1, 0); // Left
                    }
                } else {
                    // Vertical swipe
                    if (deltaY > 0) {
                        this.changeDirection(0, 1); // Down
                    } else {
                        this.changeDirection(0, -1); // Up
                    }
                }
                
                // Prevent default behavior for processed swipes
                event.preventDefault();
            }
        }, { passive: false });
    }
    
    // Generate or retrieve a persistent device ID
    getDeviceId() {
        let deviceId = localStorage.getItem('snakeRoyaleDeviceId');
        if (!deviceId) {
            // Generate a unique device ID based on timestamp and random number
            deviceId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            localStorage.setItem('snakeRoyaleDeviceId', deviceId);
        }
        return deviceId;
    }
    
    // Generate a consistent name from device ID
    generatePlayerName(deviceId) {
        // Create a simple hash from the device ID
        let hash = 0;
        for (let i = 0; i < deviceId.length; i++) {
            const char = deviceId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Use absolute value and ensure it's positive
        hash = Math.abs(hash);
        
        // List of snake-related names
        const snakeNames = [
            'Cobra', 'Python', 'Viper', 'Anaconda', 'Mamba', 'Boa', 'Rattler', 'Serpent',
            'Adder', 'Copperhead', 'Kingsnake', 'Garter', 'Coral', 'Bull', 'Milk', 'Grass',
            'Ring', 'Sand', 'Hog', 'Pine', 'Rat', 'Rock', 'Rubber', 'Smooth', 'Sharp',
            'Rough', 'Water', 'Earth', 'Fire', 'Storm', 'Thunder', 'Lightning', 'Shadow'
        ];
        
        const nameIndex = hash % snakeNames.length;
        const number = (hash % 999) + 1; // 1-999
        
        return `${snakeNames[nameIndex]}${number.toString().padStart(3, '0')}`;
    }
    
    joinGame() {
        const deviceId = this.getDeviceId();
        const playerName = this.generatePlayerName(deviceId);
        
        this.socket.emit('joinGame', { name: playerName });
    }
    
    showGameScreen() {
        document.getElementById('joinScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        document.getElementById('gameStatus').classList.remove('hidden');
        document.getElementById('leaderboard').classList.remove('hidden');
        
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Adjust canvas size for mobile
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const maxWidth = Math.min(800, window.innerWidth - 40);
        const maxHeight = Math.min(600, window.innerHeight * 0.6);
        
        const scale = Math.min(maxWidth / 800, maxHeight / 600);
        
        this.canvas.style.width = (800 * scale) + 'px';
        this.canvas.style.height = (600 * scale) + 'px';
    }
    
    changeDirection(x, y) {
        const direction = { x, y };
        // Prevent rapid direction changes
        if (this.lastDirection.x !== direction.x || this.lastDirection.y !== direction.y) {
            this.socket.emit('changeDirection', direction);
            this.lastDirection = direction;
        }
    }
    
    updateUI() {
        if (!this.gameState) return;
        
        // Update player count (only count connected players)
        const connectedPlayers = this.gameState.players.filter(p => !p.disconnected);
        document.getElementById('playerCount').textContent = `Players: ${connectedPlayers.length}`;
        
        // Update game status
        let statusText = '';
        switch (this.gameState.gameStatus) {
            case 'waiting':
                statusText = 'Waiting for players...';
                break;
            case 'playing':
                statusText = 'Battle in progress!';
                break;
            case 'ended':
                statusText = 'Game ended';
                break;
        }
        document.getElementById('gameStatusText').textContent = statusText;
        
        // Update player score and info
        const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
        if (currentPlayer) {
            document.getElementById('playerName').textContent = currentPlayer.name;
            document.getElementById('playerScore').textContent = currentPlayer.score;
            
            const isAlive = currentPlayer.alive;
            
            // Handle death state change
            if (this.wasAlive === true && !isAlive) {
                this.onPlayerDeath();
            } else if (this.wasAlive === false && isAlive) {
                this.hideRespawnUI();
            }
            
            // Handle first-time initialization when player dies before wasAlive is set
            if (this.wasAlive === null && !isAlive) {
                this.onPlayerDeath();
            }
            
            this.wasAlive = isAlive;
            document.getElementById('statusText').textContent = isAlive ? 'Alive' : 'Dead';
        }
        
        // Update leaderboard
        this.updateLeaderboard();
    }
    
    updateLeaderboard() {
        const leaderboard = [...this.gameState.players]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
        
        const leaderboardList = document.getElementById('leaderboardList');
        leaderboardList.innerHTML = leaderboard.map((player, index) => {
            const playerType = player.isNPC ? '🤖' : '🐍';
            const status = player.alive ? playerType : '💀';
            const namePrefix = player.isNPC ? '🤖 ' : '';
            return `<div>${index + 1}. ${namePrefix}${player.name} (${status}) - ${player.score}</div>`;
        }).join('');
    }
    
    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
    }
    
    onPlayerDeath() {
        this.deathTime = Date.now();
        this.showRespawnUI();
        this.startRespawnTimer();
    }
    
    showRespawnUI() {
        document.getElementById('respawnSection').classList.remove('hidden');
        document.getElementById('respawnTimer').classList.remove('hidden');
        document.getElementById('respawnButton').classList.add('hidden');
    }
    
    hideRespawnUI() {
        document.getElementById('respawnSection').classList.add('hidden');
        if (this.respawnTimer) {
            clearInterval(this.respawnTimer);
            this.respawnTimer = null;
        }
    }
    
    startRespawnTimer() {
        const RESPAWN_COOLDOWN = 10; // 10 seconds
        let remainingTime = RESPAWN_COOLDOWN;
        
        const updateTimer = () => {
            document.getElementById('respawnCountdown').textContent = remainingTime;
            
            if (remainingTime <= 0) {
                document.getElementById('respawnTimer').classList.add('hidden');
                document.getElementById('respawnButton').classList.remove('hidden');
                clearInterval(this.respawnTimer);
                this.respawnTimer = null;
            } else {
                remainingTime--;
            }
        };
        
        updateTimer(); // Initial update
        this.respawnTimer = setInterval(updateTimer, 1000);
    }
    
    requestRespawn() {
        this.socket.emit('requestRespawn');
    }
    
    render() {
        if (!this.ctx || !this.gameState) return;
        
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw game area border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.gameState.gameArea.width, this.gameState.gameArea.height);
        
        // Draw food
        if (this.gameState.food) {
            this.gameState.food.forEach(food => {
                this.drawFood(food);
            });
        }
        
        // Draw all snakes
        this.gameState.players.forEach(player => {
            if (player.alive) {
                this.drawSnake(player);
            }
        });
        
        // Draw current player's snake with special highlighting
        const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
        if (currentPlayer && currentPlayer.alive) {
            this.drawSnakeHighlight(currentPlayer);
        }
    }
    
    drawSnake(player) {
        const snake = player.snake;
        const isCurrentPlayer = player.id === this.playerId;
        const isNPC = player.isNPC;
        
        snake.body.forEach((segment, index) => {
            this.ctx.fillStyle = index === 0 ? 
                (isCurrentPlayer ? '#ffff00' : player.snake.color) : 
                player.snake.color;
                
            // Draw segment
            this.ctx.fillRect(
                Math.round(segment.x - 5), 
                Math.round(segment.y - 5), 
                10, 
                10
            );
            
            // Draw head eyes for the first segment
            if (index === 0) {
                this.ctx.fillStyle = '#000000';
                this.ctx.fillRect(Math.round(segment.x - 2), Math.round(segment.y - 2), 2, 2);
                this.ctx.fillRect(Math.round(segment.x + 1), Math.round(segment.y - 2), 2, 2);
            }
        });
        
        // Draw player name
        if (snake.body.length > 0) {
            const head = snake.body[0];
            this.ctx.fillStyle = isNPC ? '#ffaa00' : '#ffffff';
            this.ctx.font = isNPC ? 'italic 12px Arial' : '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                isNPC ? `🤖 ${player.name}` : player.name, 
                head.x, 
                head.y - 10
            );
        }
    }
    
    drawFood(food) {
        // Draw food as a glowing circle
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.shadowColor = '#ff6b6b';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(food.x, food.y, 8, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
        
        // Draw inner highlight
        this.ctx.fillStyle = '#ffaaaa';
        this.ctx.beginPath();
        this.ctx.arc(food.x, food.y, 4, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    drawSnakeHighlight(player) {
        const snake = player.snake;
        if (snake.body.length > 0) {
            const head = snake.body[0];
            
            // Draw highlight circle around player's head
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(head.x, head.y, 12, 0, 2 * Math.PI);
            this.ctx.stroke();
        }
    }
}

// Global functions for HTML onclick events
let game;

function joinGame() {
    if (!game) {
        game = new SnakeRoyaleGame();
    }
    game.joinGame();
}

function changeDirection(x, y) {
    if (game) {
        game.changeDirection(x, y);
    }
}

function requestRespawn() {
    if (game) {
        game.requestRespawn();
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    game = new SnakeRoyaleGame();
});