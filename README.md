# 🐍 Snake Royale - MMO Battle Royale Snake Game

A real-time multiplayer snake game designed for keynote presentations and large audience participation. Built for 200-300 concurrent players with mobile-friendly controls and spectator view for large screen display.

## 🎮 Game Features

- **Real-time Multiplayer**: WebSocket-based gameplay supporting hundreds of concurrent players
- **Mobile-Friendly**: Touch controls optimized for mobile devices
- **Battle Royale**: Last snake standing wins, with collision elimination
- **Spectator Mode**: Large screen display perfect for keynote presentations
- **No Authentication**: Join instantly with just a name
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Admin Controls**: Game management for presenters

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/Lukasedv/snakeroyale.git
cd snakeroyale
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the server**
```bash
npm start
```

4. **Access the game**
- Player Game: http://localhost:3000
- Spectator View: http://localhost:3000/spectator.html

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive Azure deployment guide.

#### Live Deployment URLs
- **Production** (stable): http://snake-royale-prod.swedencentral.azurecontainer.io:3000
- **Development** (PR testing): http://snake-royale-dev-pr-[NUMBER].swedencentral.azurecontainer.io:3000

The production URL remains consistent across deployments, while development URLs are created for each pull request to enable testing before merging.

## 🎯 How to Play

1. **Join the Game**: Enter your name and click "Join Battle"
2. **Control Your Snake**: 
   - **Desktop**: Arrow keys or WASD
   - **Mobile**: Touch the directional buttons
3. **Survive**: Avoid colliding with walls, yourself, or other snakes
4. **Win**: Be the last snake alive!

## 📱 Mobile Controls

The game features intuitive touch controls optimized for mobile devices:
- Large, responsive directional buttons
- Prevent accidental scrolling
- Optimized canvas scaling for different screen sizes

## 🖥️ Spectator Mode

Perfect for keynote presentations:
- Large-screen optimized display
- Real-time leaderboard
- Game statistics and player count
- Admin controls for game management
- Beautiful visual effects and animations

### Admin Controls
- **Restart Game**: Start a new round
- **Pause/Resume**: Pause the current game
- **Clear Players**: Remove all players

## 🏗️ Architecture

### Backend (Node.js + Socket.IO)
- Express.js server serving static files
- Socket.IO for real-time WebSocket communication
- Game state management with collision detection
- Support for both players and spectators

### Frontend (Vanilla JavaScript + HTML5 Canvas)
- Canvas-based rendering for smooth gameplay
- Responsive design with CSS Grid and Flexbox
- Touch-optimized controls for mobile
- Real-time game state synchronization

### Deployment (Azure Container Instances)
- Dockerized application for easy deployment
- GitHub Actions CI/CD pipeline
- Azure Container Registry for image storage
- Cost-optimized scaling for events

## 🔧 Technical Requirements

- **Server**: Node.js 18+ with WebSocket support
- **Client**: Modern web browser with HTML5 Canvas support
- **Mobile**: iOS Safari, Android Chrome, or similar modern mobile browsers
- **Network**: Stable internet connection for real-time gameplay

## 📊 Performance

- **Concurrent Players**: Tested with 200-300 simultaneous connections
- **Game Loop**: 60 FPS server-side game updates
- **Latency**: <100ms typical WebSocket round-trip time
- **Memory**: ~4GB RAM recommended for 300 players
- **CPU**: 2+ cores recommended for optimal performance

## 🚀 Deployment Options

### Azure Container Instances (Recommended)
- Cost-effective pay-per-use model
- Quick scaling for events
- No infrastructure management
- Estimated cost: $50-100/month for events

### Alternative Platforms
- **Docker**: Works with any Docker-compatible platform
- **Heroku**: Easy deployment with WebSocket support
- **AWS/GCP**: Container services or serverless options
- **Self-hosted**: VPS or dedicated server

## 🛠️ Development

### Project Structure
```
snakeroyale/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── public/                # Client-side files
│   ├── index.html         # Main game page
│   ├── game.js            # Game client logic
│   ├── spectator.html     # Spectator view
│   └── spectator.js       # Spectator logic
├── Dockerfile             # Container configuration
├── .github/workflows/     # CI/CD pipeline
└── DEPLOYMENT.md          # Deployment guide
```

### Environment Variables
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

### Development Commands
```bash
npm start       # Start production server
npm run dev     # Start with nodemon for development
npm test        # Run tests (currently placeholder)
```

## 🎨 Customization

### Game Settings
Modify `server.js` to adjust:
- Game area size
- Player movement speed
- Collision detection sensitivity
- Maximum players per game

### Visual Styling
Modify CSS in HTML files to customize:
- Color schemes
- UI layout
- Mobile responsiveness
- Animation effects

## 🐛 Troubleshooting

### Common Issues

1. **WebSocket Connection Fails**
   - Check firewall settings
   - Verify port 3000 is accessible
   - Ensure WebSocket support in proxy/load balancer

2. **High Latency**
   - Use server closer to users
   - Scale up server resources
   - Check network connectivity

3. **Mobile Touch Issues**
   - Ensure viewport meta tag is set
   - Verify touch event handlers
   - Test on actual devices

### Performance Optimization
- Use process manager (PM2) for production
- Enable gzip compression
- Implement connection pooling
- Add Redis for session management (multi-instance)

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For deployment assistance or technical support:
- Create an issue in this repository
- Check the deployment guide
- Review troubleshooting section

## 🌟 Features Roadmap

- [ ] Power-ups and special abilities
- [ ] Tournament bracket system
- [ ] Replay system
- [ ] Enhanced spectator camera controls
- [ ] Team-based game modes
- [ ] Leaderboard persistence
- [ ] Custom snake skins
- [ ] Sound effects and music

---

Built with ❤️ for awesome keynote presentations and interactive audience engagement!