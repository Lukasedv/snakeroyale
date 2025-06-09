// Spectator view logic
class SpectatorView {
    constructor() {
        this.socket = io();
        this.canvas = null;
        this.ctx = null;
        this.gameState = null;
        this.gameStartTime = null;
        this.lastFrameTime = Date.now();
        this.frameCount = 0;
        this.fps = 60;
        
        this.initializeSocket();
        this.initializeCanvas();
        this.startFPSCounter();
    }
    
    initializeSocket() {
        this.socket.on('connect', () => {
            console.log('Spectator connected to server');
            this.updateConnectionStatus(true);
            
            // Join as spectator
            this.socket.emit('joinSpectator');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Spectator disconnected from server');
            this.updateConnectionStatus(false);
        });
        
        this.socket.on('gameUpdate', (gameState) => {
            this.gameState = gameState;
            this.updateUI();
            this.render();
        });
        
        this.socket.on('gameStarted', () => {
            this.gameStartTime = Date.now();
            console.log('Game started');
        });
        
        this.socket.on('gameEnded', (data) => {
            console.log('Game ended', data);
            if (data.winner) {
                this.showWinner(data.winner);
            }
        });
        
        this.socket.on('playerJoined', (player) => {
            console.log('Player joined:', player.name);
        });
        
        this.socket.on('playerLeft', (playerId) => {
            console.log('Player left:', playerId);
        });
        
        // Admin events
        this.socket.on('gameRestarted', () => {
            this.gameStartTime = null;
            console.log('Game restarted by admin');
        });
        
        this.socket.on('keynoteToggled', (isKeynoteMode) => {
            console.log('Keynote mode toggled:', isKeynoteMode);
            this.updateKeynoteButton(isKeynoteMode);
            this.handleKeynoteMode(isKeynoteMode);
        });
    }
    
    initializeCanvas() {
        this.canvas = document.getElementById('spectatorCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Adjust canvas size for display
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const maxWidth = Math.min(1200, window.innerWidth * 0.7);
        const maxHeight = Math.min(800, window.innerHeight * 0.7);
        
        const scale = Math.min(maxWidth / 1200, maxHeight / 800);
        
        this.canvas.style.width = (1200 * scale) + 'px';
        this.canvas.style.height = (800 * scale) + 'px';
    }
    
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (connected) {
            statusElement.className = 'connection-status connected';
            statusElement.innerHTML = '🟢 Connected';
        } else {
            statusElement.className = 'connection-status disconnected';
            statusElement.innerHTML = '🔴 Disconnected';
        }
    }
    
    updateKeynoteButton(isKeynoteMode) {
        const keynoteBtn = document.getElementById('keynoteBtn');
        if (isKeynoteMode) {
            keynoteBtn.classList.add('keynote-active');
            keynoteBtn.innerHTML = '🎯 RESUME GAME';
        } else {
            keynoteBtn.classList.remove('keynote-active');
            keynoteBtn.innerHTML = '🎯 KEYNOTE MODE';
        }
    }
    
    handleKeynoteMode(isKeynoteMode) {
        if (isKeynoteMode) {
            this.showKeynoteOverlay();
        } else {
            this.hideKeynoteOverlay();
        }
    }
    
    showKeynoteOverlay() {
        // Remove existing overlay if it exists
        this.hideKeynoteOverlay();
        
        // Create keynote overlay for spectator
        const overlay = document.createElement('div');
        overlay.id = 'spectatorKeynoteOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 5000;
            font-family: Arial, sans-serif;
            pointer-events: none;
        `;
        
        overlay.innerHTML = `
            <div style="
                text-align: center;
                color: white;
                font-size: 2em;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                max-width: 60%;
                padding: 30px;
                background: rgba(0,0,0,0.4);
                border-radius: 15px;
                border: 2px solid #4ecdc4;
            ">
                <div style="font-size: 1.1em; color: #4ecdc4; margin-bottom: 15px;">
                    🎯 KEYNOTE MODE ACTIVE
                </div>
                <div style="font-size: 0.7em; line-height: 1.3;">
                    Spectator view - Game paused for keynote
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }
    
    hideKeynoteOverlay() {
        const overlay = document.getElementById('spectatorKeynoteOverlay');
        if (overlay) {
            document.body.removeChild(overlay);
        }
    }
    
    updateUI() {
        if (!this.gameState) return;
        
        // Update player counts (only count connected players for active count, but show alive/dead including disconnected)
        const connectedPlayers = this.gameState.players.filter(p => !p.disconnected);
        const totalPlayers = connectedPlayers.length;
        const alivePlayers = this.gameState.players.filter(p => p.alive).length;
        
        document.getElementById('playerCount').textContent = `Players: ${totalPlayers}`;
        document.getElementById('totalPlayers').textContent = totalPlayers;
        document.getElementById('alivePlayers').textContent = alivePlayers;
        
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
        
        // Update game timer
        if (this.gameStartTime && this.gameState.gameStatus === 'playing') {
            const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            document.getElementById('gameTimer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            document.getElementById('gameTime').textContent = `${elapsed}s`;
        }
        
        // Update leaderboard
        this.updateLeaderboard();
        
        // Update server info
        document.getElementById('serverInfo').textContent = window.location.host;
    }
    
    updateLeaderboard() {
        if (!this.gameState) return;
        
        const leaderboard = [...this.gameState.players]
            .sort((a, b) => {
                // Sort by alive status first, then by score
                if (a.alive !== b.alive) {
                    return b.alive - a.alive;
                }
                return b.score - a.score;
            })
            .slice(0, 15); // Show top 15 players
        
        const leaderboardElement = document.getElementById('leaderboard');
        
        if (leaderboard.length === 0) {
            leaderboardElement.innerHTML = '<div class="leaderboard-item"><span>Waiting for players...</span></div>';
            return;
        }
        
        leaderboardElement.innerHTML = leaderboard.map((player, index) => {
            const statusClass = player.alive ? 'alive' : 'dead';
            const playerType = player.isNPC ? '🤖' : '🐍';
            const statusIcon = player.alive ? playerType : '💀';
            const rank = index + 1;
            const namePrefix = player.isNPC ? '🤖 ' : '';
            const disconnectedSuffix = player.disconnected ? ' (DC)' : '';
            
            return `
                <div class="leaderboard-item">
                    <div>
                        <span class="player-name">${rank}. ${namePrefix}${player.name}${disconnectedSuffix}</span>
                        <br>
                        <span class="player-status ${statusClass}">${statusIcon} ${player.alive ? 'Alive' : 'Dead'}</span>
                    </div>
                    <div>
                        <strong>${player.score}</strong>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    startFPSCounter() {
        setInterval(() => {
            this.fps = Math.round(this.frameCount * 2); // Update every 500ms
            this.frameCount = 0;
            document.getElementById('fps').textContent = this.fps;
        }, 500);
    }
    
    showWinner(winner) {
        // Create a winner overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            font-size: 3em;
            color: gold;
            text-align: center;
            animation: fadeIn 0.5s ease-in;
        `;
        
        overlay.innerHTML = `
            <div>
                <div>🏆 WINNER! 🏆</div>
                <div style="font-size: 0.6em; margin-top: 20px;">${winner.name}</div>
                <div style="font-size: 0.4em; margin-top: 10px;">Score: ${winner.score}</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Remove overlay after 5 seconds
        setTimeout(() => {
            document.body.removeChild(overlay);
        }, 5000);
    }
    
    render() {
        if (!this.ctx || !this.gameState) return;
        
        this.frameCount++;
        
        // Scale canvas to game area
        const scaleX = this.canvas.width / this.gameState.gameArea.width;
        const scaleY = this.canvas.height / this.gameState.gameArea.height;
        
        // Clear canvas with gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw game area border
        this.ctx.strokeStyle = '#4ecdc4';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
        
        // Draw grid
        this.drawGrid();
        
        // Draw food
        if (this.gameState.food) {
            this.gameState.food.forEach(food => {
                this.drawFood(food, scaleX, scaleY);
            });
        }
        
        // Draw all snakes
        this.gameState.players.forEach(player => {
            if (player.alive) {
                this.drawSnake(player, scaleX, scaleY);
            }
        });
        
        // Draw dead snakes with transparency
        this.gameState.players.forEach(player => {
            if (!player.alive) {
                this.drawDeadSnake(player, scaleX, scaleY);
            }
        });
    }
    
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        this.ctx.lineWidth = 1;
        
        const gridSize = 40;
        
        // Vertical lines
        for (let x = gridSize; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = gridSize; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawFood(food, scaleX, scaleY) {
        const x = food.x * scaleX;
        const y = food.y * scaleY;
        const size = 16; // Larger for spectator view
        
        // Draw food as a glowing circle
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.shadowColor = '#ff6b6b';
        this.ctx.shadowBlur = 15;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size/2, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
        
        // Draw inner highlight
        this.ctx.fillStyle = '#ffaaaa';
        this.ctx.beginPath();
        this.ctx.arc(x, y, size/4, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    drawSnake(player, scaleX, scaleY) {
        const snake = player.snake;
        
        snake.body.forEach((segment, index) => {
            const x = segment.x * scaleX;
            const y = segment.y * scaleY;
            const size = 12;
            
            // Draw segment with glow effect
            this.ctx.shadowColor = player.snake.color;
            this.ctx.shadowBlur = 15;
            this.ctx.fillStyle = index === 0 ? '#ffff00' : player.snake.color;
            this.ctx.fillRect(x - size/2, y - size/2, size, size);
            
            // Draw head details
            if (index === 0) {
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = '#000000';
                this.ctx.fillRect(x - 3, y - 3, 2, 2);
                this.ctx.fillRect(x + 1, y - 3, 2, 2);
            }
        });
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
        
        // Draw player name with better visibility
        if (snake.body.length > 0) {
            const head = snake.body[0];
            const x = head.x * scaleX;
            const y = head.y * scaleY;
            
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(x - 30, y - 25, 60, 16);
            
            this.ctx.fillStyle = player.isNPC ? '#ffaa00' : '#ffffff';
            this.ctx.font = player.isNPC ? 'italic bold 12px Arial' : 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(player.isNPC ? `🤖 ${player.name}` : player.name, x, y - 12);
        }
    }
    
    drawDeadSnake(player, scaleX, scaleY) {
        if (!player.deathTime) return; // Don't draw if no death time recorded
        
        const snake = player.snake;
        const fadeTime = 5000; // 5 seconds to fade completely
        const timeSinceDeath = Date.now() - player.deathTime;
        
        // Don't draw if the snake has been dead for more than fade time
        if (timeSinceDeath > fadeTime) return;
        
        // Calculate fade factor (1.0 = fully visible, 0.0 = completely faded)
        const fadeFactor = Math.max(0, 1 - (timeSinceDeath / fadeTime));
        const alpha = 0.3 * fadeFactor; // Start at 0.3 opacity and fade to 0
        
        snake.body.forEach((segment, index) => {
            const x = segment.x * scaleX;
            const y = segment.y * scaleY;
            const size = 12;
            
            // Draw with fading transparency and dark color
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = index === 0 ? '#666666' : '#444444';
            this.ctx.fillRect(x - size/2, y - size/2, size, size);
        });
        
        this.ctx.globalAlpha = 1.0;
    }
}

// Admin control functions
function restartGame() {
    if (spectator && spectator.socket) {
        spectator.socket.emit('adminRestart');
    }
}

function pauseGame() {
    if (spectator && spectator.socket) {
        spectator.socket.emit('adminPause');
    }
}

function clearPlayers() {
    if (spectator && spectator.socket) {
        spectator.socket.emit('adminClearPlayers');
    }
}

function toggleKeynoteMode() {
    if (spectator && spectator.socket) {
        spectator.socket.emit('adminToggleKeynote');
    }
}

// Initialize spectator when page loads
let spectator;

document.addEventListener('DOMContentLoaded', () => {
    spectator = new SpectatorView();
});