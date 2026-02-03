# 🎈 Balloon Pop - Hand Tracking Game

A fun and interactive balloon shooting game that uses hand tracking with your webcam! Pop balloons by moving your hand and opening your palm.

## Features

- **Hand Tracking**: Uses MediaPipe Hands library to detect hand position and gestures
- **Webcam Integration**: Smooth camera access via getUserMedia API
- **Interactive Gameplay**: Use hand gestures or click/touch to pop balloons
- **Score Tracking**: Different balloon colors award different points
- **Timer-based**: 60-second rounds to challenge yourself
- **Progressive Difficulty**: Balloons spawn faster and move quicker as your score increases
- **Smooth 60 FPS Performance**: Optimized for smooth gameplay
- **Responsive Design**: Works on desktop and mobile devices

## How to Play

1. **Allow Camera Access**: Click "Start Game" and allow camera permission
2. **Aim with Your Hand**: Move your hand to control the crosshair cursor
3. **Pop Balloons**: Open your palm (or click/tap) to shoot and pop balloons
4. **Score Points**: Different colored balloons award different points:
   - Red: 10 points
   - Teal: 15 points
   - Blue: 20 points
   - Orange: 25 points
   - Mint: 30 points
   - Yellow: 35 points
   - Purple: 40 points
5. **Beat the Clock**: Pop as many balloons as you can in 60 seconds!

## Technologies Used

- **HTML5 Canvas**: For game rendering
- **MediaPipe Hands**: For hand tracking and gesture recognition
- **getUserMedia API**: For webcam access
- **JavaScript (ES6+)**: Game logic and animations
- **CSS3**: Styling and animations

## Game Controls

- **Move Hand**: Control crosshair position
- **Open Palm**: Shoot/pop balloons
- **Click/Tap**: Alternative shooting method

## Privacy

Camera feed is processed locally in your browser and is never uploaded to any server. All hand tracking happens client-side using MediaPipe.

## Deployment

The game is deployed on GitHub Pages:
- **Live URL**: https://stasik5.github.io/balloon-shooting-game/
- **Repository**: https://github.com/stasik5/balloon-shooting-game

## Browser Compatibility

Works best on modern browsers with:
- WebRTC support (for camera access)
- WebGL support (for smooth canvas rendering)
- ES6+ JavaScript support

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Tips

- Use a well-lit room for better hand tracking
- Keep your hand visible in the camera frame
- Stand back slightly for better detection range

## License

MIT License - Feel free to use and modify!

## Credits

Built with ❤️ using MediaPipe and modern web technologies.
