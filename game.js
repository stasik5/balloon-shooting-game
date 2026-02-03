// Balloon Pop Game with Hand Tracking
// Using MediaPipe Hands for hand detection

class BalloonGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('webcam');
        this.landmarkCanvas = document.getElementById('landmark-canvas');
        this.landmarkCtx = this.landmarkCanvas.getContext('2d');
        
        // Game state
        this.score = 0;
        this.timeLeft = 60;
        this.gameRunning = false;
        this.balloons = [];
        this.handPosition = null;
        this.isPinching = false;
        this.wasPinching = false;
        this.pinchDistance = 0;
        this.pinchThreshold = 0.05; // Normalized distance threshold for pinch
        this.lastShotTime = 0;
        this.shootCooldown = 200; // ms between shots
        
        // Timing
        this.lastBalloonSpawn = 0;
        this.balloonSpawnRate = 1000; // ms between spawns
        this.gameStartTime = 0;
        
        // Hand tracking
        this.hands = null;
        this.camera = null;
        
        // Colors for balloons
        this.balloonColors = [
            { color: '#FF6B6B', points: 10 },
            { color: '#4ECDC4', points: 15 },
            { color: '#45B7D1', points: 20 },
            { color: '#FFA07A', points: 25 },
            { color: '#98D8C8', points: 30 },
            { color: '#F7DC6F', points: 35 },
            { color: '#BB8FCE', points: 40 }
        ];
        
        this.setupEventListeners();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    setupEventListeners() {
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.startGame());
        document.getElementById('menu-btn').addEventListener('click', () => this.showScreen('start-screen'));
        document.getElementById('retry-btn').addEventListener('click', () => this.startGame());
        document.getElementById('error-menu-btn').addEventListener('click', () => this.showScreen('start-screen'));
        
        // Click to shoot as fallback
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleClick({ clientX: touch.clientX, clientY: touch.clientY });
        });
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.landmarkCanvas.width = this.canvas.width;
        this.landmarkCanvas.height = this.canvas.height;
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
    
    async startGame() {
        this.showScreen('loading-screen');
        
        try {
            // Initialize camera
            await this.initializeCamera();
            
            // Initialize MediaPipe Hands
            await this.initializeHands();
            
            // Reset game state
            this.score = 0;
            this.timeLeft = 60;
            this.balloons = [];
            this.gameRunning = true;
            this.gameStartTime = Date.now();
            this.updateHUD();
            
            // Start game loop
            this.showScreen('game-screen');
            this.gameLoop();
            this.startTimer();
            
        } catch (error) {
            console.error('Failed to start game:', error);
            this.showError(error.message);
        }
    }
    
    async initializeCamera() {
        return new Promise((resolve, reject) => {
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            };
            
            navigator.mediaDevices.getUserMedia(constraints)
                .then(stream => {
                    this.video.srcObject = stream;
                    this.video.onloadedmetadata = () => {
                        this.video.play();
                        resolve();
                    };
                })
                .catch(error => {
                    reject(new Error('Camera access denied. Please allow camera permission to play.'));
                });
        });
    }
    
    async initializeHands() {
        return new Promise((resolve, reject) => {
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
                }
            });
            
            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });
            
            this.hands.onResults((results) => this.onHandResults(results));
            
            // Start camera processing
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    if (this.gameRunning) {
                        await this.hands.send({ image: this.video });
                    }
                },
                width: 1280,
                height: 720
            });
            
            this.camera.start().then(resolve).catch(reject);
        });
    }
    
    onHandResults(results) {
        this.landmarkCtx.clearRect(0, 0, this.landmarkCanvas.width, this.landmarkCanvas.height);
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            // Get index finger tip (landmark 8) for aiming
            const indexTip = landmarks[8];
            this.handPosition = {
                x: (1 - indexTip.x) * this.canvas.width, // Mirror horizontally
                y: indexTip.y * this.canvas.height
            };
            
            // Detect pinching gesture
            // Calculate distance between thumb tip (landmark 4) and index finger tip (landmark 8)
            const thumbTip = landmarks[4];
            const pinchDistance = Math.hypot(
                thumbTip.x - indexTip.x,
                thumbTip.y - indexTip.y
            );
            
            this.pinchDistance = pinchDistance;
            this.wasPinching = this.isPinching;
            
            // Check if pinching (distance below threshold)
            this.isPinching = pinchDistance < this.pinchThreshold;
            
            // Shoot when pinch is made (rising edge detection)
            if (this.isPinching && !this.wasPinching) {
                this.shoot();
            }
            
            // Draw hand visualization
            this.drawHand(landmarks);
        } else {
            this.handPosition = null;
            this.isPinching = false;
            this.wasPinching = false;
            this.pinchDistance = 0;
        }
    }
    
    drawHand(landmarks) {
        this.ctx.save();
        
        // Draw aiming cursor at index finger tip
        const indexTip = landmarks[8];
        const cursorX = (1 - indexTip.x) * this.canvas.width;
        const cursorY = indexTip.y * this.canvas.height;
        
        // Draw crosshair cursor
        const cursorSize = 30;
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 3;
        
        this.ctx.beginPath();
        this.ctx.moveTo(cursorX - cursorSize, cursorY);
        this.ctx.lineTo(cursorX + cursorSize, cursorY);
        this.ctx.moveTo(cursorX, cursorY - cursorSize);
        this.ctx.lineTo(cursorX, cursorY + cursorSize);
        this.ctx.stroke();
        
        // Draw circle around cursor
        this.ctx.beginPath();
        this.ctx.arc(cursorX, cursorY, cursorSize, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw pinch indicator when pinching
        if (this.isPinching) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(cursorX, cursorY, cursorSize - 5, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw pinch distance indicator (visual feedback)
        // Show a smaller inner circle that grows/shrinks based on pinch distance
        const innerRadius = (this.pinchDistance / (this.pinchThreshold * 2)) * (cursorSize - 10);
        this.ctx.strokeStyle = this.isPinching ? '#00FF00' : '#FFA500';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(cursorX, cursorY, Math.max(5, innerRadius), 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    shoot() {
        const now = Date.now();
        if (now - this.lastShotTime < this.shootCooldown) return;
        
        this.lastShotTime = now;
        
        if (!this.handPosition) return;
        
        // Check for balloon hits
        for (let i = this.balloons.length - 1; i >= 0; i--) {
            const balloon = this.balloons[i];
            const distance = Math.hypot(
                balloon.x - this.handPosition.x,
                balloon.y - this.handPosition.y
            );
            
            if (distance < balloon.radius + 20) {
                // Pop the balloon!
                this.score += balloon.points;
                this.createPopEffect(balloon.x, balloon.y, balloon.color);
                this.balloons.splice(i, 1);
                this.updateHUD();
                break; // Only pop one balloon per shot
            }
        }
    }
    
    handleClick(e) {
        if (!this.gameRunning) return;
        
        this.handPosition = {
            x: e.clientX,
            y: e.clientY
        };
        
        this.shoot();
    }
    
    createPopEffect(x, y, color) {
        // Create particle effect for balloon pop
        const particles = [];
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI * 2 / 10) * i;
            const speed = 3 + Math.random() * 5;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color: color
            });
        }
        
        // Animate particles
        const animateParticles = () => {
            let alive = false;
            particles.forEach(p => {
                if (p.life > 0) {
                    alive = true;
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.2; // Gravity
                    p.life -= 0.03;
                    
                    if (p.life > 0) {
                        this.ctx.globalAlpha = p.life;
                        this.ctx.fillStyle = p.color;
                        this.ctx.beginPath();
                        this.ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                        this.ctx.fill();
                        this.ctx.globalAlpha = 1;
                    }
                }
            });
            
            if (alive && this.gameRunning) {
                requestAnimationFrame(animateParticles);
            }
        };
        
        animateParticles();
    }
    
    spawnBalloon() {
        const colorData = this.balloonColors[Math.floor(Math.random() * this.balloonColors.length)];
        const radius = 30 + Math.random() * 20;
        
        const balloon = {
            x: radius + Math.random() * (this.canvas.width - radius * 2),
            y: this.canvas.height + radius,
            radius: radius,
            color: colorData.color,
            points: colorData.points,
            speed: 1 + Math.random() * 2 + (this.score / 500), // Speed increases with score
            wobbleOffset: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.02 + Math.random() * 0.02,
            wobbleAmount: 0.5 + Math.random() * 1
        };
        
        this.balloons.push(balloon);
    }
    
    updateBalloons() {
        const now = Date.now();
        
        // Spawn new balloons
        if (now - this.lastBalloonSpawn > this.balloonSpawnRate) {
            this.spawnBalloon();
            this.lastBalloonSpawn = now;
            
            // Gradually increase spawn rate
            if (this.balloonSpawnRate > 400) {
                this.balloonSpawnRate -= 10;
            }
        }
        
        // Update balloon positions
        for (let i = this.balloons.length - 1; i >= 0; i--) {
            const balloon = this.balloons[i];
            
            // Move balloon up with wobble
            balloon.y -= balloon.speed;
            balloon.wobbleOffset += balloon.wobbleSpeed;
            balloon.x += Math.sin(balloon.wobbleOffset) * balloon.wobbleAmount;
            
            // Remove balloons that go off screen
            if (balloon.y < -balloon.radius) {
                this.balloons.splice(i, 1);
            }
        }
    }
    
    drawBalloons() {
        this.balloons.forEach(balloon => {
            this.ctx.save();
            
            // Draw balloon body
            const gradient = this.ctx.createRadialGradient(
                balloon.x - balloon.radius * 0.3,
                balloon.y - balloon.radius * 0.3,
                0,
                balloon.x,
                balloon.y,
                balloon.radius
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, balloon.color);
            gradient.addColorStop(1, this.darkenColor(balloon.color, 30));
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.ellipse(balloon.x, balloon.y, balloon.radius, balloon.radius * 1.15, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw balloon string
            this.ctx.strokeStyle = '#666';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(balloon.x, balloon.y + balloon.radius * 1.15);
            this.ctx.quadraticCurveTo(
                balloon.x + Math.sin(balloon.wobbleOffset) * 10,
                balloon.y + balloon.radius * 1.5,
                balloon.x,
                balloon.y + balloon.radius * 2
            );
            this.ctx.stroke();
            
            // Draw knot
            this.ctx.fillStyle = balloon.color;
            this.ctx.beginPath();
            this.ctx.moveTo(balloon.x - 5, balloon.y + balloon.radius * 1.12);
            this.ctx.lineTo(balloon.x + 5, balloon.y + balloon.radius * 1.12);
            this.ctx.lineTo(balloon.x, balloon.y + balloon.radius * 1.2);
            this.ctx.closePath();
            this.ctx.fill();
            
            this.ctx.restore();
        });
    }
    
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max((num >> 16) - amt, 0);
        const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
        const B = Math.max((num & 0x0000FF) - amt, 0);
        return `rgb(${R}, ${G}, ${B})`;
    }
    
    updateHUD() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('timer').textContent = this.timeLeft;
    }
    
    startTimer() {
        const timerInterval = setInterval(() => {
            if (!this.gameRunning) {
                clearInterval(timerInterval);
                return;
            }
            
            this.timeLeft--;
            this.updateHUD();
            
            if (this.timeLeft <= 0) {
                this.endGame();
                clearInterval(timerInterval);
            }
        }, 1000);
    }
    
    endGame() {
        this.gameRunning = false;
        
        // Stop camera
        if (this.camera) {
            this.camera.stop();
        }
        
        // Stop video stream
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        
        // Show game over screen
        document.getElementById('final-score-display').textContent = this.score;
        
        // Set score message based on performance
        const messageEl = document.getElementById('score-message');
        if (this.score >= 1000) {
            messageEl.textContent = '🎉 Incredible! You\'re a balloon-popping master!';
        } else if (this.score >= 500) {
            messageEl.textContent = '🌟 Amazing! Great hand-eye coordination!';
        } else if (this.score >= 250) {
            messageEl.textContent = '👏 Well done! Keep practicing!';
        } else if (this.score >= 100) {
            messageEl.textContent = '👍 Good start! Try to beat your score!';
        } else {
            messageEl.textContent = '💪 Nice try! Practice makes perfect!';
        }
        
        this.showScreen('gameover-screen');
    }
    
    showError(message) {
        document.getElementById('error-message').textContent = message;
        this.showScreen('error-screen');
        
        // Stop camera if running
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
    }
    
    gameLoop() {
        if (!this.gameRunning) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background gradient
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        bgGradient.addColorStop(0, '#87CEEB');
        bgGradient.addColorStop(1, '#98FB98');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw clouds
        this.drawClouds();
        
        // Update and draw balloons
        this.updateBalloons();
        this.drawBalloons();
        
        // Draw hand visualization (if hand detected)
        if (this.handPosition) {
            // Redraw cursor
            const cursorSize = 30;
            this.ctx.strokeStyle = '#FF0000';
            this.ctx.lineWidth = 3;
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.handPosition.x - cursorSize, this.handPosition.y);
            this.ctx.lineTo(this.handPosition.x + cursorSize, this.handPosition.y);
            this.ctx.moveTo(this.handPosition.x, this.handPosition.y - cursorSize);
            this.ctx.lineTo(this.handPosition.x, this.handPosition.y + cursorSize);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.arc(this.handPosition.x, this.handPosition.y, cursorSize, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Draw pinch indicator
            if (this.isPinching) {
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                this.ctx.beginPath();
                this.ctx.arc(this.handPosition.x, this.handPosition.y, cursorSize - 5, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            // Draw pinch distance indicator
            const innerRadius = (this.pinchDistance / (this.pinchThreshold * 2)) * (cursorSize - 10);
            this.ctx.strokeStyle = this.isPinching ? '#00FF00' : '#FFA500';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.handPosition.x, this.handPosition.y, Math.max(5, innerRadius), 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        // Continue game loop at 60 FPS
        requestAnimationFrame(() => this.gameLoop());
    }
    
    drawClouds() {
        // Draw some decorative clouds
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        
        const time = Date.now() / 10000;
        
        // Cloud 1
        this.drawCloud(100 + Math.sin(time) * 20, 80, 1);
        // Cloud 2
        this.drawCloud(this.canvas.width - 200 + Math.cos(time * 0.7) * 20, 150, 0.8);
        // Cloud 3
        this.drawCloud(this.canvas.width / 2 + Math.sin(time * 0.5) * 30, 200, 1.2);
    }
    
    drawCloud(x, y, scale) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.scale(scale, scale);
        
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 30, 0, Math.PI * 2);
        this.ctx.arc(25, -10, 25, 0, Math.PI * 2);
        this.ctx.arc(50, 0, 30, 0, Math.PI * 2);
        this.ctx.arc(25, 10, 20, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new BalloonGame();
});
