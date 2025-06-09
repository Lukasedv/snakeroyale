// Game client logic
class SnakeRoyaleGame {
    constructor() {
        this.socket = io();
        this.canvas = null;
        this.ctx = null;
        this.playerId = null;
        this.gameState = null;
        this.lastDirection = { x: 1, y: 0 };
        
        this.initializeSocket();
        this.setupKeyboardControls();
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
    
    joinGame() {
        const nameInput = document.getElementById('playerName');
        const playerName = nameInput.value.trim() || `Player${Math.floor(Math.random() * 1000)}`;
        
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
        
        // Update player count
        document.getElementById('playerCount').textContent = `Players: ${this.gameState.players.length}`;
        
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
        document.getElementById('gameStatus').textContent = statusText;
        
        // Update player score
        const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
        if (currentPlayer) {
            document.getElementById('playerScore').textContent = currentPlayer.score;
            document.getElementById('statusText').textContent = currentPlayer.alive ? 'Alive' : 'Dead';
        }
        
        // Update leaderboard
        this.updateLeaderboard();
    }
    
    updateLeaderboard() {
        const leaderboard = [...this.gameState.players]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
        
        const leaderboardList = document.getElementById('leaderboardList');
        leaderboardList.innerHTML = leaderboard.map((player, index) => 
            `<div>${index + 1}. ${player.name} (${player.alive ? '🐍' : '💀'}) - ${player.score}</div>`
        ).join('');
    }
    
    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
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
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                player.name, 
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

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    game = new SnakeRoyaleGame();
    
    // Focus on name input
    document.getElementById('playerName').focus();
    
    // Allow enter key to join game
    document.getElementById('playerName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinGame();
        }
    });
});