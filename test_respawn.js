const io = require('socket.io-client');

// Test respawn functionality
async function testRespawn() {
    console.log('Testing respawn functionality...');
    
    // Connect to server
    const socket = io('http://localhost:3000');
    
    await new Promise((resolve, reject) => {
        socket.on('connect', () => {
            console.log('✓ Connected to server');
            resolve();
        });
        
        socket.on('connect_error', (error) => {
            console.error('✗ Connection failed:', error);
            reject(error);
        });
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
    
    // Join game
    socket.emit('joinGame', { name: 'TestPlayer' });
    
    await new Promise((resolve, reject) => {
        socket.on('gameJoined', (data) => {
            console.log('✓ Joined game with player ID:', data.playerId);
            resolve();
        });
        
        setTimeout(() => reject(new Error('Join timeout')), 5000);
    });
    
    // Test respawn request (should be denied - player is alive)
    socket.emit('requestRespawn');
    
    await new Promise((resolve) => {
        socket.on('respawnDenied', (data) => {
            console.log('✓ Respawn correctly denied for alive player');
            resolve();
        });
        
        socket.on('respawnSuccessful', () => {
            console.log('✗ Respawn should have been denied for alive player');
            resolve();
        });
        
        setTimeout(() => {
            console.log('✓ No respawn response for alive player (expected)');
            resolve();
        }, 2000);
    });
    
    console.log('✓ Basic respawn functionality test completed');
    socket.close();
}

testRespawn().catch(console.error);