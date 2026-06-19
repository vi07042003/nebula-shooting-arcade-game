import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RefreshCcw, Home, Settings, Pause, ChevronRight, Zap, Skull, ShieldAlert, X, Shield, Timer, Zap as RapidIcon, Layers } from 'lucide-react';

const ShootingGame = ({ level, onGameOver, onQuit, onOpenSettings, controls, enabledPowerUps, isDemoMode = false, playMode = 'manual', gestureSettings }) => {
  const gs = gestureSettings || {
    detectionConfidence: 0.5,
    trackingConfidence: 0.5,
    fistThreshold: 0.65,
    mirrorFeed: true,
    modelComplexity: 1
  };
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [fuel, setFuel] = useState(100);
  const [bossHealth, setBossHealth] = useState(null);
  const [activeEffects, setActiveEffects] = useState({ shield: 0, multishot: 0, rapidfire: 0, slowmo: 0, laser: 0, sidecannons: 0, drone: 0, speedboost: 0 });
  const [glitchActive, setGlitchActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const requestRef = useRef();
  
  // Hand tracking states & refs
  const [gestureStatus, setGestureStatus] = useState('Off');
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const handCoordinates = useRef({ x: 0.5, y: 0.8, isClosed: false });
  const playModeRef = useRef(playMode);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  // MediaPipe hands detection loop
  useEffect(() => {
    if (playMode !== 'gesture') {
      setGestureStatus('Off');
      if (cameraRef.current) {
        try { cameraRef.current.stop(); } catch(e){}
        cameraRef.current = null;
      }
      if (handsRef.current) {
        try { handsRef.current.close(); } catch(e){}
        handsRef.current = null;
      }
      return;
    }

    setGestureStatus('Initializing Neural Link...');
    let active = true;
    let localCamera = null;
    let localHands = null;

    const initMediaPipe = async () => {
      try {
        if (!window.Hands || !window.Camera) {
          for (let i = 0; i < 15; i++) {
            if (window.Hands && window.Camera) break;
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        if (!window.Hands || !window.Camera) {
          throw new Error('Neural tracking libraries missing from host matrix.');
        }

        const handsObj = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        handsObj.setOptions({
          maxNumHands: 1,
          modelComplexity: gs.modelComplexity,
          minDetectionConfidence: gs.detectionConfidence,
          minTrackingConfidence: gs.trackingConfidence
        });

        handsObj.onResults((results) => {
          if (!active) return;
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const wrist = landmarks[0];
            const middleMcp = landmarks[9];
            const handScale = Math.sqrt((wrist.x - middleMcp.x)**2 + (wrist.y - middleMcp.y)**2);
            
            if (handScale > 0.01) {
              let closedFingers = 0;
              const fingers = [
                { tip: 8, mcp: 5 },
                { tip: 12, mcp: 9 },
                { tip: 16, mcp: 13 },
                { tip: 20, mcp: 17 }
              ];
              fingers.forEach(f => {
                const dist = Math.sqrt((landmarks[f.tip].x - landmarks[f.mcp].x)**2 + (landmarks[f.tip].y - landmarks[f.mcp].y)**2);
                if (dist / handScale < gs.fistThreshold) {
                  closedFingers++;
                }
              });
              const isClosed = closedFingers >= 3;

              handCoordinates.current = {
                x: gs.mirrorFeed ? 1 - middleMcp.x : middleMcp.x, // Mirrored or normal camera coordinates
                y: middleMcp.y,
                isClosed
              };

              setGestureStatus(isClosed ? 'Closed (Teleport Charging)' : 'Active');
            }
          } else {
            setGestureStatus('Hand Out Of Range');
          }
        });

        localHands = handsObj;
        handsRef.current = handsObj;

        if (videoRef.current) {
          const cameraObj = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (!active) return;
              try {
                await handsObj.send({ image: videoRef.current });
              } catch (e) {}
            },
            width: 320,
            height: 240
          });

          cameraObj.start()
            .then(() => {
              if (!active) return;
              setCameraActive(true);
              setGestureStatus('Active');
            })
            .catch(err => {
              console.error('Camera matrix failure:', err);
              if (active) setGestureStatus('Access Denied');
            });

          localCamera = cameraObj;
          cameraRef.current = cameraObj;
        }
      } catch (err) {
        console.error('Failed to establish neural camera link:', err);
        if (active) setGestureStatus('Offline');
      }
    };

    initMediaPipe();

    return () => {
      active = false;
      setCameraActive(false);
      if (localCamera) {
        try { localCamera.stop(); } catch(e){}
      }
      if (localHands) {
        try { localHands.close(); } catch(e){}
      }
    };
  }, [playMode, gestureSettings]);
  
  const targetScore = level * 3500;
  const isBossLevel = level % 5 === 0;
  
  const gameState = useRef({
    player: { x: 0, y: 0, targetX: 0, targetY: 0, w: 90, h: 90, friction: 0.18, recoil: 0 },
    projectiles: [],
    enemyProjectiles: [],
    powerups: [],
    enemies: [],
    particles: [],
    stars: [],
    boss: null,
    keys: {},
    lastEnemySpawn: 0,
    lastFire: 0,
    score: 0,
    isGameOver: false,
    shake: 0,
    levelWon: false,
    fuel: 100,
    echoHistory: [],
    leash: null, // { target: enemy, length: number }
    glitch: { active: false, options: [], timer: 0 },
    teleportCharging: false,
    teleportTargetX: undefined,
    teleportTargetY: undefined,
    effects: { shield: 0, multishot: 0, rapidfire: 0, slowmo: 0, laser: 0, sidecannons: 0, drone: 0, speedboost: 0 }
  });

  const resetGame = () => {
    gameState.current = {
        ...gameState.current,
        projectiles: [],
        enemyProjectiles: [],
        enemies: [],
        powerups: [],
        particles: [],
        boss: null,
        score: 0,
        isGameOver: false,
        shake: 0,
        levelWon: false,
        teleportCharging: false,
        teleportTargetX: undefined,
        teleportTargetY: undefined,
        effects: { shield: 0, multishot: 0, rapidfire: 0, slowmo: 0, laser: 0, sidecannons: 0, drone: 0, speedboost: 0 }
    };
    setScore(0);
    setHealth(100);
    setFuel(100);
    setBossHealth(null);
    setIsPaused(false);
    setGlitchActive(false);
    setActiveEffects({ shield: 0, multishot: 0, rapidfire: 0, slowmo: 0, laser: 0, sidecannons: 0, drone: 0, speedboost: 0 });
  };

  const images = useRef({
    player: new Image(),
    enemy: new Image(),
    enemyTank: new Image(),
    enemySpeeder: new Image(),
    enemyHeavy: new Image(),
    boss: new Image(),
    background: new Image(),
    ready: false
  });

  const processedImages = useRef({
    player: null,
    enemy: null,
    enemyTank: null,
    enemySpeeder: null,
    enemyHeavy: null,
    boss: null
  });

  const processImage = (img, tolerance = 40, brighten = 1.0, hue = 0) => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width; tempCanvas.height = img.height;
    const tctx = tempCanvas.getContext('2d');
    if (hue !== 0) tctx.filter = `hue-rotate(${hue}deg) saturate(2.5)`;
    tctx.drawImage(img, 0, 0);
    const imageData = tctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    const bgR = data[0], bgG = data[1], bgB = data[2];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
      if (diff < tolerance) { data[i+3] = 0; } else {
        data[i] = Math.min(255, r * brighten + 40);
        data[i+1] = Math.min(255, g * brighten);
        data[i+2] = Math.min(255, b * brighten);
      }
    }
    tctx.putImageData(imageData, 0, 0);
    return tempCanvas;
  };

  useEffect(() => {
    images.current.player.src = '/player.png';
    images.current.enemy.src = '/enemy.png';
    images.current.enemyTank.src = '/enemy_tank.png';
    images.current.enemySpeeder.src = '/enemy_speeder.png';
    images.current.enemyHeavy.src = '/enemy_heavy.png';
    images.current.boss.src = '/Boss.png';
    images.current.background.src = '/background.png';

    const handleLoad = () => {
      const im = images.current;
      if (im.player.complete && im.enemy.complete && im.enemyTank.complete && 
          im.enemySpeeder.complete && im.enemyHeavy.complete && im.boss.complete) {
        processedImages.current.player = processImage(im.player, 80, 1.1, 0);
        processedImages.current.enemy = processImage(im.enemy, 45, 1.0, 0);
        processedImages.current.enemyTank = processImage(im.enemyTank, 45, 1.0, 0); 
        processedImages.current.enemySpeeder = processImage(im.enemySpeeder, 45, 1.0, 0);
        processedImages.current.enemyHeavy = processImage(im.enemyHeavy, 45, 1.0, 0);
        processedImages.current.boss = processImage(im.boss, 45, 1.0, level * 45); 
        images.current.ready = true;
      }
    };
    images.current.player.onload = handleLoad;
    images.current.enemy.onload = handleLoad;
    images.current.enemyTank.onload = handleLoad;
    images.current.enemySpeeder.onload = handleLoad;
    images.current.enemyHeavy.onload = handleLoad;
    images.current.boss.onload = handleLoad;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      gameState.current.player.x = canvas.width / 2; gameState.current.player.y = canvas.height - 150;
      gameState.current.player.targetX = canvas.width / 2; gameState.current.player.targetY = canvas.height - 150;
      gameState.current.stars = Array.from({ length: 200 }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2, speed: 0.5 + Math.random() * 4
      }));
    };
    window.addEventListener('resize', resize); resize();
    const onKeyDown = (e) => { 
        gameState.current.keys[e.code] = true; 
        if (e.code === 'Escape') setIsPaused(prev => !prev);
    };
    const onKeyUp = (e) => gameState.current.keys[e.code] = false;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const spawnEnemy = (timestamp) => {
      if (gameState.current.boss || gameState.current.score >= targetScore) return; 
      const spawnRate = Math.max(180, 800 - level * 35);
      if (timestamp - gameState.current.lastEnemySpawn > spawnRate) {
        let type = 'STANDARD';
        if (level > 2 && Math.random() > 0.6) type = 'SPEEDER';
        if (level > 6 && Math.random() > 0.75) type = 'TANK';
        if (level > 11 && Math.random() > 0.85) type = 'HEAVY';
        const cfg = {
          STANDARD: { w: 75, h: 75, speed: 4.5, hp: 1, color: '#ff3333', img: 'enemy' },
          SPEEDER: { w: 55, h: 55, speed: 11, hp: 1, color: '#33ccff', img: 'enemySpeeder' },
          TANK: { w: 105, h: 105, speed: 2.8, hp: 6, color: '#33ff88', img: 'enemyTank' },
          HEAVY: { w: 135, h: 135, speed: 2.2, hp: 12, color: '#ff33ff', img: 'enemyHeavy' }
        }[type];
        gameState.current.enemies.push({ x: Math.random() * (canvas.width - 150) + 75, y: -150, ...cfg, type, currentHp: cfg.hp });
        gameState.current.lastEnemySpawn = timestamp;
      }
    };

    const dropPowerup = (x, y) => {
        if (Math.random() > 0.30) return;
        const allTypes = [
            { id: 'shield', char: '🛡️', color: '#00f2ff' },
            { id: 'multishot', char: '🔱', color: '#ff00ff' },
            { id: 'rapidfire', char: '⚡', color: '#ffaa00' },
            { id: 'slowmo', char: '🌀', color: '#00ff66' },
            { id: 'laser', char: '🔥', color: '#ff0033' },
            { id: 'missiles', char: '🚀', color: '#aaaaaa' },
            { id: 'sidecannons', char: '🔫', color: '#ffff00' },
            { id: 'extralife', char: '💖', color: '#ff66aa' },
            { id: 'drone', char: '🛸', color: '#aaff00' },
            { id: 'speedboost', char: '💨', color: '#00ccff' },
            { id: 'glitch', char: '👾', color: '#ff00ff' }
        ];
        // Only drop powerups that the user has enabled in the dashboard
        const filtered = allTypes.filter(p => enabledPowerUps.includes(p.id));
        if (filtered.length === 0) return;
        
        const type = filtered[Math.floor(Math.random() * filtered.length)];
        gameState.current.powerups.push({ x, y, ...type, vy: 2.5 });
    };

    const dropFuel = (x, y) => {
        gameState.current.powerups.push({ id: 'fuel', char: '⛽', color: '#ffd700', x, y, vy: 3 });
    };

    const update = (timestamp) => {
      if (gameState.current.isGameOver || isPaused || gameState.current.levelWon) {
        if (isPaused) draw(ctx, canvas);
        requestRef.current = requestAnimationFrame(update); return;
      }

      const { player, keys, projectiles, enemyProjectiles, enemies, powerups, particles, stars, boss, effects } = gameState.current;

      // Effect Timers
      Object.keys(effects).forEach(k => { if(effects[k] > 0) effects[k] -= 16.6; if(effects[k] < 0) effects[k] = 0; });
      if (timestamp % 200 < 20) setActiveEffects({ ...effects }); // Periodic sync with React state

      if (playModeRef.current === 'gesture') {
        // Auto-firing: simulate controls.fire key pressed
        keys[controls.fire] = true;
        keys['Space'] = true;

        const currentHand = handCoordinates.current;
        const targetXVal = currentHand.x * canvas.width;
        const targetYVal = currentHand.y * canvas.height;

        if (currentHand.isClosed) {
          gameState.current.teleportCharging = true;
          gameState.current.teleportTargetX = Math.max(player.w / 2, Math.min(canvas.width - player.w / 2, targetXVal));
          gameState.current.teleportTargetY = Math.max(80, Math.min(canvas.height - 80, targetYVal));
        } else {
          if (gameState.current.teleportCharging) {
            // TELEPORT ENGAGED!
            const startX = player.x;
            const startY = player.y;
            const destX = gameState.current.teleportTargetX !== undefined ? gameState.current.teleportTargetX : player.x;
            const destY = gameState.current.teleportTargetY !== undefined ? gameState.current.teleportTargetY : player.y;

            player.x = destX;
            player.y = destY;
            player.targetX = destX;
            player.targetY = destY;

            // Teleport visual particle shockwave
            for (let k = 0; k < 40; k++) {
              particles.push({
                x: startX, y: startY,
                vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15,
                life: 0.8, color: '#00f2ff', size: 3 + Math.random() * 3
              });
              particles.push({
                x: destX, y: destY,
                vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
                life: 1.0, color: '#ff00ff', size: 4 + Math.random() * 4
              });
            }

            gameState.current.shake = 25;
            gameState.current.teleportCharging = false;
          } else {
            // Normal horizontal movement following hand
            player.targetX = Math.max(player.w / 2, Math.min(canvas.width - player.w / 2, targetXVal));
          }
        }

        player.x += (player.targetX - player.x) * player.friction;
        player.y += (player.targetY - player.y) * player.friction + player.recoil;
        player.recoil *= 0.85;
      } else {
        // Keyboard Manual Control
        const moveSpeed = (15 + (level * 0.1)) * (effects.speedboost > 0 ? 1.6 : 1);
        if (keys[controls.left]) player.targetX -= moveSpeed;
        if (keys[controls.right]) player.targetX += moveSpeed;
        if (keys[controls.up]) player.targetY -= moveSpeed;
        if (keys[controls.down]) player.targetY += moveSpeed;

        player.x += (player.targetX - player.x) * player.friction;
        player.y += (player.targetY - player.y) * player.friction + player.recoil;
        player.recoil *= 0.85;
      }

      // FUEL CONSUMPTION
      let isMoving = false;
      if (playModeRef.current === 'gesture') {
        isMoving = Math.abs(player.targetX - player.x) > 2;
      } else {
        isMoving = keys[controls.left] || keys[controls.right] || keys[controls.up] || keys[controls.down];
      }
      if (!isDemoMode) {
        gameState.current.fuel -= isMoving ? 0.06 : 0.02;
      }
      
      if (gameState.current.fuel <= 0) {
          gameState.current.fuel = 0;
          endGame(); // Fuel out = Mission Failed
      }
      
      if (timestamp % 200 < 20) setFuel(Math.ceil(gameState.current.fuel));

      // Fuel logic - More frequent drops (every 3 seconds) when below 35%
      if (gameState.current.fuel < 35 && timestamp % 3000 < 20) {
          dropFuel(Math.random() * (canvas.width - 100) + 50, -50);
      }

      // CHRONO-ECHO RECORDING
      gameState.current.echoHistory.push({ x: player.x, y: player.y, time: timestamp, isFiring: keys[controls.fire] || keys['Space'] });
      if (gameState.current.echoHistory.length > 180) gameState.current.echoHistory.shift();

      // ECHO SNAP (Q)
      if (keys['KeyQ'] && gameState.current.echoHistory.length > 60) {
          const echo = gameState.current.echoHistory[0];
          player.x = echo.x; player.y = echo.y;
          player.targetX = echo.x; player.targetY = echo.y;
          gameState.current.echoHistory = [];
          gameState.current.shake = 15;
          keys['KeyQ'] = false; // Prevent rapid snapping
      }

      // GRAVITY LEASH (E)
      if (keys['KeyE']) {
          if (gameState.current.leash) {
              gameState.current.leash = null;
          } else {
              const nearest = enemies.reduce((prev, curr) => {
                  const d1 = Math.sqrt((prev.x - player.x)**2 + (prev.y - player.y)**2);
                  const d2 = Math.sqrt((curr.x - player.x)**2 + (curr.y - player.y)**2);
                  return d1 < d2 ? prev : curr;
              }, enemies[0]);
              if (nearest && Math.sqrt((nearest.x - player.x)**2 + (nearest.y - player.y)**2) < 400) {
                  gameState.current.leash = { target: nearest, length: 150 };
              }
          }
          keys['KeyE'] = false;
      }

      if (gameState.current.leash) {
          const l = gameState.current.leash;
          const dx = l.target.x - player.x;
          const dy = l.target.y - player.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const angle = Math.atan2(dy, dx);
          
          if (dist > l.length) {
              l.target.x = player.x + Math.cos(angle) * l.length;
              l.target.y = player.y + Math.sin(angle) * l.length;
          }
          // Physics: Leashed enemy deals damage to others
          enemies.forEach(e => {
              if (e !== l.target && Math.sqrt((e.x - l.target.x)**2 + (e.y - l.target.y)**2) < 100) {
                  e.currentHp -= 5;
                  if (timestamp % 100 < 20) {
                      for(let k=0; k<5; k++) particles.push({ x: e.x, y: e.y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 0.5, color: '#fff', size: 2 });
                  }
              }
          });
      }

      const margin = player.w / 2;
      if (player.x > canvas.width + margin) { player.x = -margin; player.targetX = -margin; }
      else if (player.x < -margin) { player.x = canvas.width + margin; player.targetX = canvas.width + margin; }
      player.y = Math.max(80, Math.min(canvas.height - 80, player.y));
      player.targetY = Math.max(80, Math.min(canvas.height - 80, player.targetY));

      // POWERUP COLLECTION
      for (let i = powerups.length - 1; i >= 0; i--) {
          powerups[i].y += powerups[i].vy;
          const dist = Math.sqrt((powerups[i].x-player.x)**2 + (powerups[i].y-player.y)**2);
          if (dist < 60) {
              const p = powerups[i];
              if (p.id === 'shield' || p.id === 'extralife') setHealth(100);
              else if (p.id === 'fuel') {
                  gameState.current.fuel = Math.min(100, gameState.current.fuel + 40);
                  setFuel(Math.ceil(gameState.current.fuel));
              }
              else if (p.id === 'missiles') {
                  for (let j = enemies.length - 1; j >= 0; j--) {
                      enemies[j].currentHp -= 10;
                      if (enemies[j].currentHp <= 0) {
                          gameState.current.score += 200;
                          setScore(gameState.current.score);
                      }
                  }
              }
              else effects[p.id] = (p.id === 'slowmo' || p.id === 'laser' || p.id === 'missiles' ? 10000 : 15000);
              powerups.splice(i, 1);
              gameState.current.shake = 10;
              if (p.id === 'glitch') {
                  const options = [
                      { label: 'Enemy.speed = 0', effect: () => { enemies.forEach(e => e.speed = 0); } },
                      { label: 'Player.health = 999', effect: () => { setHealth(999); } },
                      { label: 'Level.skip = true', effect: () => { gameState.current.score = targetScore + 1; } }
                  ];
                  gameState.current.glitch = { active: true, options, timer: 5000 };
                  setGlitchActive(true);
                  setIsPaused(true);
              }
              continue;
          }
          if (powerups[i].y > canvas.height + 50) powerups.splice(i, 1);
      }

      // FIRING LOGIC
      const cooldown = effects.rapidfire > 0 ? 50 : 100;
      if ((keys[controls.fire] || keys['Space']) && timestamp - gameState.current.lastFire > cooldown) {
        if (effects.laser > 0) {
            projectiles.push({ x: player.x, y: player.y - 120, vy: -50, vx: 0, size: 15, color: '#ff0033' });
        } else if (effects.multishot > 0) {
            projectiles.push({ x: player.x, y: player.y - 45, vy: -22, vx: 0, size: 7, color: '#00f2ff' });
            projectiles.push({ x: player.x, y: player.y - 45, vy: -21, vx: -5, size: 7, color: '#00f2ff' });
            projectiles.push({ x: player.x, y: player.y - 45, vy: -21, vx: 5, size: 7, color: '#00f2ff' });
        } else {
            projectiles.push({ x: player.x, y: player.y - 45, vy: -22, vx: 0, size: 7, color: '#00f2ff' });
        }
        
        if (effects.sidecannons > 0 && !effects.laser) {
            projectiles.push({ x: player.x - 40, y: player.y - 10, vy: -15, vx: -12, size: 6, color: '#ffff00' });
            projectiles.push({ x: player.x + 40, y: player.y - 10, vy: -15, vx: 12, size: 6, color: '#ffff00' });
        }
        
        if (effects.drone > 0 && !effects.laser) {
             projectiles.push({ x: player.x - 60, y: player.y + 20, vy: -20, vx: 0, size: 4, color: '#aaff00' });
             projectiles.push({ x: player.x + 60, y: player.y + 20, vy: -20, vx: 0, size: 4, color: '#aaff00' });
        }
        
        gameState.current.lastFire = timestamp; player.recoil = 5;
      }

      stars.forEach(s => { s.y += s.speed; if (s.y > canvas.height) s.y = 0; });
      for (let i = projectiles.length - 1; i >= 0; i--) {
        projectiles[i].y += projectiles[i].vy; 
        projectiles[i].x += (projectiles[i].vx || 0); 
        if (projectiles[i].y < -50) projectiles.splice(i, 1);
      }

      const worldSpeed = effects.slowmo > 0 ? 0.4 : 1;
      
      for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        enemyProjectiles[i].y += enemyProjectiles[i].vy * worldSpeed; 
        if (enemyProjectiles[i].y > canvas.height + 50) enemyProjectiles.splice(i, 1);
        if (Math.sqrt((enemyProjectiles[i].x-player.x)**2 + (enemyProjectiles[i].y-player.y)**2) < 42) {
            enemyProjectiles.splice(i, 1); setHealth(prev => { const n = prev - 12; if (n <= 0) endGame(); return n; }); gameState.current.shake = 10;
        }
      }

      if (isBossLevel && gameState.current.score >= targetScore && !boss) {
        gameState.current.enemies = [];
        const bossHp = level * 30;
        gameState.current.boss = { x: canvas.width / 2, y: -450, w: 450, h: 450, targetX: canvas.width / 2, targetY: 220, hp: bossHp, currentHp: bossHp, color: '#ff0000', lastShot: 0, flash: 0, phase: 1 };
        setBossHealth(100); gameState.current.shake = 30;
      } else if (!isBossLevel && gameState.current.score >= targetScore && !gameState.current.levelWon) {
        gameState.current.levelWon = true; setTimeout(() => onGameOver(gameState.current.score, true), 1000);
      }

      if (boss) {
        boss.y += (boss.targetY - boss.y) * 0.03 * worldSpeed; boss.x += Math.sin(timestamp / 400) * 5 * worldSpeed;
        if (boss.flash > 0) boss.flash -= 0.1;
        if (boss.currentHp < boss.hp * 0.5) boss.phase = 2;
        const shotDelay = boss.phase === 2 ? 600 : 1200;
        if (timestamp - boss.lastShot > (shotDelay - level * 30) / worldSpeed) {
            const count = boss.phase === 2 ? 10 : 6;
            for(let a=0; a<count; a++) {
                const spread = (a - (count/2)) * 60;
                enemyProjectiles.push({ x: boss.x + spread, y: boss.y + 100, vy: 5 + level/3, color: '#ff3333' });
            }
            boss.lastShot = timestamp;
        }
        for (let j = projectiles.length - 1; j >= 0; j--) {
            if (Math.sqrt((boss.x-projectiles[j].x)**2 + (boss.y-projectiles[j].y)**2) < boss.w / 2.1) {
                boss.currentHp--; boss.flash = 1.0; projectiles.splice(j, 1);
                setBossHealth((boss.currentHp / boss.hp) * 100);
                if (boss.currentHp <= 0) {
                    gameState.current.score += 10000; setScore(gameState.current.score);
                    for(let k=0; k<150; k++) particles.push({ x: boss.x, y: boss.y, vx: (Math.random()-0.5)*40, vy: (Math.random()-0.5)*40, life: 2.5, color: '#ffaa00', size: 10 });
                    gameState.current.boss = null; gameState.current.levelWon = true;
                    setTimeout(() => onGameOver(gameState.current.score, true), 2500);
                }
            }
        }
      } else { spawnEnemy(timestamp); }

      for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].speed * worldSpeed; if (enemies[i].type === 'SPEEDER') enemies[i].x += Math.sin(timestamp / 70) * 10 * worldSpeed;
        if (Math.sqrt((enemies[i].x-player.x)**2 + (enemies[i].y-player.y)**2) < 58) {
          enemies.splice(i, 1); gameState.current.shake = 18; setHealth(prev => { const n = prev - 25; if (n <= 0) endGame(); return n; }); continue;
        }
        for (let j = projectiles.length - 1; j >= 0; j--) {
          if (Math.sqrt((enemies[i].x-projectiles[j].x)**2 + (enemies[i].y-projectiles[j].y)**2) < enemies[i].w/1.7) {
            enemies[i].currentHp--; projectiles.splice(j, 1);
            if (enemies[i].currentHp <= 0) {
              dropPowerup(enemies[i].x, enemies[i].y);
              const pts = { STANDARD: 100, SPEEDER: 250, TANK: 450, HEAVY: 800 }[enemies[i].type];
              for(let k=0; k<25; k++) particles.push({ x: enemies[i].x, y: enemies[i].y, vx: (Math.random()-0.5)*18, vy: (Math.random()-0.5)*18, life: 1, color: enemies[i].color, size: 4 });
              enemies.splice(i, 1); gameState.current.score += pts; setScore(gameState.current.score);
            } else { for(let k=0; k<6; k++) particles.push({ x: projectiles[j].x, y: projectiles[j].y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 0.5, color: '#fff', size: 3 }); }
            break;
          }
        }
        if (enemies[i] && enemies[i].y > canvas.height + 250) enemies.splice(i, 1);
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx * worldSpeed; particles[i].y += particles[i].vy * worldSpeed; particles[i].life -= 0.035;
        if (particles[i].life <= 0) particles.splice(i, 1);
      }

      if (gameState.current.shake > 0) gameState.current.shake *= 0.88;
      draw(ctx, canvas); requestRef.current = requestAnimationFrame(update);
    };

    const endGame = () => { gameState.current.isGameOver = true; onGameOver(gameState.current.score, false); };

    const draw = (ctx, canvas) => {
      ctx.save();
      if (gameState.current.shake > 0.1) ctx.translate((Math.random()-0.5)*gameState.current.shake, (Math.random()-0.5)*gameState.current.shake);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(images.current.background, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff'; gameState.current.stars.forEach(s => { ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill(); });

      if (images.current.ready) {
        if (gameState.current.boss) {
            const b = gameState.current.boss; ctx.save(); ctx.translate(b.x, b.y);
            if (b.flash > 0) ctx.filter = `brightness(${1 + b.flash * 4})`;
            ctx.shadowBlur = 60; ctx.shadowColor = b.phase === 2 ? '#ff6600' : '#ff0000';
            ctx.drawImage(processedImages.current.boss, -b.w/2, -b.h/2, b.w, b.h);
            ctx.beginPath(); ctx.arc(0, 0, 30 + Math.sin(Date.now()/100)*10, 0, Math.PI*2); ctx.fillStyle = b.phase === 2 ? '#ffcc00' : '#ff3300'; ctx.fill(); ctx.restore();
        }
        gameState.current.enemies.forEach(e => {
            const img = processedImages.current[e.img]; ctx.save(); ctx.translate(e.x, e.y);
            if (e.type === 'TANK') { ctx.beginPath(); ctx.arc(0, 0, e.w*0.75, 0, Math.PI*2); ctx.strokeStyle = '#00ff6644'; ctx.lineWidth = 4; ctx.stroke(); }
            ctx.shadowBlur = 25; ctx.shadowColor = e.color; ctx.drawImage(img, -e.w/2, -e.h/2, e.w, e.h); ctx.restore();
            if (e.hp > 1) {
                const hpW = (e.currentHp / e.hp) * e.w; ctx.fillStyle = '#111'; ctx.fillRect(e.x - e.w/2, e.y - e.h/2 - 20, e.w, 8); ctx.fillStyle = e.color; ctx.fillRect(e.x - e.w/2, e.y - e.h/2 - 20, hpW, 8);
            }
        });

        gameState.current.powerups.forEach(p => {
            const glow = 20 + Math.sin(Date.now()/150) * 10;
            ctx.save(); ctx.translate(p.x, p.y);
            // Pulsing Outer Ring
            ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.arc(0, 0, 28 + Math.sin(Date.now()/200)*6, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
            // Glowing Core
            ctx.shadowBlur = glow; ctx.shadowColor = p.color;
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
            // Icon
            ctx.shadowBlur = 0; ctx.fillStyle = '#000'; ctx.font = '22px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(p.char, 0, 0); ctx.restore();
        });

        ctx.save();
        ctx.translate(gameState.current.player.x, gameState.current.player.y);
        
        const effects = gameState.current.effects;
        
        // Draw Power-Up Auras behind player
        if (effects.shield > 0) {
            ctx.beginPath(); ctx.arc(0, 0, 50 + Math.sin(Date.now()/100)*5, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(0, 242, 255, ${0.4 + Math.sin(Date.now()/150)*0.3})`;
            ctx.lineWidth = 4; ctx.stroke();
            ctx.fillStyle = 'rgba(0, 242, 255, 0.15)'; ctx.fill();
        }
        if (effects.slowmo > 0) {
            ctx.beginPath(); ctx.arc(0, 0, 65, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(0, 255, 102, ${0.3 + Math.sin(Date.now()/200)*0.2})`;
            ctx.setLineDash([10, 15]); ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
        }
        
        // DRAW GRAVITY LEASH BEAM
        if (gameState.current.leash) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(gameState.current.leash.target.x - gameState.current.player.x, gameState.current.leash.target.y - gameState.current.player.y);
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2 + Math.sin(Date.now()/50)*2;
            ctx.shadowBlur = 15; ctx.shadowColor = '#ff00ff';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // DRAW CHRONO-ECHO GHOST
        if (gameState.current.echoHistory.length > 60) {
            const echo = gameState.current.echoHistory[0];
            ctx.save();
            ctx.translate(echo.x - gameState.current.player.x, echo.y - gameState.current.player.y);
            ctx.globalAlpha = 0.3;
            ctx.filter = 'drop-shadow(0 0 10px #00f2ff) hue-rotate(180deg)';
            ctx.drawImage(processedImages.current.player, -gameState.current.player.w/2, -gameState.current.player.h/2, gameState.current.player.w, gameState.current.player.h);
            ctx.restore();
        }
        
        ctx.shadowBlur = effects.rapidfire > 0 ? 40 : 25; 
        if (effects.rapidfire > 0 && effects.multishot > 0) ctx.shadowColor = '#fff';
        else if (effects.rapidfire > 0) ctx.shadowColor = '#ffaa00';
        else if (effects.multishot > 0) ctx.shadowColor = '#ff00ff';
        else ctx.shadowColor = '#00f2ff';
        
        // Dematerialize ship if charging teleport
        if (playModeRef.current === 'gesture' && gameState.current.teleportCharging) {
          ctx.globalAlpha = 0.35 + Math.sin(Date.now() / 50) * 0.15;
          ctx.filter = 'hue-rotate(90deg) saturate(2.5)';
        }

        ctx.drawImage(processedImages.current.player, -gameState.current.player.w/2, -gameState.current.player.h/2, gameState.current.player.w, gameState.current.player.h);
        
        if (effects.multishot > 0) {
             ctx.globalAlpha = 0.4; ctx.globalCompositeOperation = 'screen';
             ctx.drawImage(processedImages.current.player, -gameState.current.player.w/2 - 25, -gameState.current.player.h/2 + 15, gameState.current.player.w, gameState.current.player.h);
             ctx.drawImage(processedImages.current.player, -gameState.current.player.w/2 + 25, -gameState.current.player.h/2 + 15, gameState.current.player.w, gameState.current.player.h);
        }
        if (effects.drone > 0) {
            ctx.beginPath(); ctx.arc(-60, 20, 15, 0, Math.PI*2); ctx.fillStyle = '#111'; ctx.fill(); ctx.strokeStyle='#aaff00'; ctx.stroke();
            ctx.beginPath(); ctx.arc(60, 20, 15, 0, Math.PI*2); ctx.fillStyle = '#111'; ctx.fill(); ctx.strokeStyle='#aaff00'; ctx.stroke();
        }

        ctx.restore();      }

      // DRAW TELEPORT TARGET RETICLE
      if (playModeRef.current === 'gesture' && gameState.current.teleportCharging && gameState.current.teleportTargetX !== undefined) {
        const tx = gameState.current.teleportTargetX;
        const ty = gameState.current.teleportTargetY;
        
        ctx.save();
        ctx.translate(tx, ty);
        
        // Holographic pulsing circle
        const pulse = 35 + Math.sin(Date.now() / 80) * 10;
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff00ff';
        ctx.beginPath();
        ctx.arc(0, 0, pulse, 0, Math.PI * 2);
        ctx.stroke();
        
        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(-pulse - 10, 0); ctx.lineTo(-pulse + 5, 0);
        ctx.moveTo(pulse + 10, 0); ctx.lineTo(pulse - 5, 0);
        ctx.moveTo(0, -pulse - 10); ctx.lineTo(0, -pulse + 5);
        ctx.moveTo(0, pulse + 10); ctx.lineTo(0, pulse - 5);
        ctx.stroke();
        
        // Outer warning bracket
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, pulse + 15, -Math.PI/4, Math.PI/4); ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, pulse + 15, Math.PI * 3/4, Math.PI * 5/4); ctx.stroke();
        
        // Draw mini ghost ship inside reticle
        if (processedImages.current.player) {
          ctx.globalAlpha = 0.4;
          ctx.filter = 'drop-shadow(0 0 8px #ff00ff) saturate(2)';
          ctx.drawImage(processedImages.current.player, -gameState.current.player.w/2, -gameState.current.player.h/2, gameState.current.player.w, gameState.current.player.h);
        }
        
        ctx.restore();
      }

      gameState.current.projectiles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fillStyle = p.color; ctx.fill(); ctx.shadowBlur = 15; ctx.shadowColor = p.color;
      });
      gameState.current.enemyProjectiles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.fillStyle = p.color; ctx.fill(); ctx.shadowBlur = 20; ctx.shadowColor = p.color;
      });
      gameState.current.particles.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 4, 0, Math.PI*2); ctx.fill(); });
      ctx.restore();
    };

    requestRef.current = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(requestRef.current); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [isPaused, level, onGameOver, controls]);

  return (
    <div className={`relative w-full h-screen overflow-hidden ${isPaused ? '' : 'cursor-none'} bg-black font-sans`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* Hand Gesture Camera Overlay */}
      {playMode === 'gesture' && (
        <div className="absolute bottom-10 left-10 z-[120] flex flex-col gap-3">
          <div className="glass-card p-3 border border-white/10 rounded-3xl bg-black/85 shadow-[0_0_40px_rgba(0,242,255,0.2)] flex flex-col items-center">
            {/* Webcam Video */}
            <div className="relative w-48 h-36 rounded-2xl overflow-hidden border border-white/10 bg-black/90 shadow-inner">
              <video 
                ref={videoRef}
                className="w-full h-full object-cover"
                style={{ transform: gs.mirrorFeed ? 'scaleX(-1)' : 'none' }}
                playsInline
                muted
              />
              {/* Status Indicator Overlay */}
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 flex items-center gap-1.5 shadow">
                <span className={`w-2 h-2 rounded-full ${
                  gestureStatus === 'Active' 
                    ? 'bg-cyan-400 animate-pulse' 
                    : gestureStatus.includes('Charging')
                      ? 'bg-fuchsia-400 animate-pulse shadow-[0_0_8px_#ff00ff]'
                      : gestureStatus.includes('Initializing') 
                        ? 'bg-amber-400 animate-pulse' 
                        : 'bg-red-500'
                }`} />
                <span className="text-[8px] font-black uppercase tracking-[0.15em] text-white/90 font-mono">{gestureStatus}</span>
              </div>
              
              {/* Teleport ready prompt */}
              {(gestureStatus === 'Active' || gestureStatus.includes('Charging')) && (
                <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-black/85 border border-white/5 text-[8px] text-gray-400 font-bold uppercase tracking-wider text-center">
                  ✊ Fist to Charge · ✋ Open to Teleport
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {isDemoMode && (
        <div className="absolute top-0 left-0 right-0 z-[150] flex items-center justify-center py-3 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border-b border-primary/30 backdrop-blur-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span className="text-primary font-black uppercase tracking-[0.4em] text-sm">Demo Mode</span>
            </div>
            <span className="text-gray-500 text-xs font-bold tracking-widest uppercase">·</span>
            <span className="text-gray-400 text-xs font-bold tracking-widest uppercase">Use WASD + Space to play</span>
            <span className="text-gray-500 text-xs font-bold tracking-widest uppercase">·</span>
            <button
              onClick={onQuit}
              className="px-4 py-1.5 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-red-500/10 transition-colors"
            >
              ✕ Exit Demo
            </button>
          </div>
        </div>
      )}
      
      <div className="absolute top-28 left-80 flex gap-4 z-[90] flex-wrap">
          <div className="glass-card p-3 flex items-center gap-2 text-primary border-primary/20"><ChevronRight size={14}/> Q: SNAP | E: LEASH</div>
          {activeEffects.shield > 0 && <div className="glass-card p-3 flex items-center gap-2 text-primary animate-pulse"><Shield size={18}/> {Math.ceil(activeEffects.shield/1000)}s</div>}
          {activeEffects.multishot > 0 && <div className="glass-card p-3 flex items-center gap-2 text-purple-500 animate-pulse"><Layers size={18}/> {Math.ceil(activeEffects.multishot/1000)}s</div>}
          {activeEffects.rapidfire > 0 && <div className="glass-card p-3 flex items-center gap-2 text-[#ffaa00] animate-pulse"><RapidIcon size={18}/> {Math.ceil(activeEffects.rapidfire/1000)}s</div>}
          {activeEffects.slowmo > 0 && <div className="glass-card p-3 flex items-center gap-2 text-green-500 animate-pulse"><Timer size={18}/> {Math.ceil(activeEffects.slowmo/1000)}s</div>}
          {activeEffects.laser > 0 && <div className="glass-card p-3 flex items-center gap-2 text-red-500 animate-pulse"><RapidIcon size={18}/> {Math.ceil(activeEffects.laser/1000)}s</div>}
          {activeEffects.sidecannons > 0 && <div className="glass-card p-3 flex items-center gap-2 text-yellow-400 animate-pulse"><Layers size={18}/> {Math.ceil(activeEffects.sidecannons/1000)}s</div>}
          {activeEffects.drone > 0 && <div className="glass-card p-3 flex items-center gap-2 text-[#aaff00] animate-pulse"><Play size={18}/> {Math.ceil(activeEffects.drone/1000)}s</div>}
          {activeEffects.speedboost > 0 && <div className="glass-card p-3 flex items-center gap-2 text-cyan-300 animate-pulse"><RapidIcon size={18}/> {Math.ceil(activeEffects.speedboost/1000)}s</div>}
      </div>

      {bossHealth !== null && gameState.current.boss && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[700px] flex flex-col items-center gap-3 z-[80]">
              <div className="flex items-center gap-4 text-red-500 font-black tracking-[1em] animate-pulse text-xl drop-shadow-lg"><Skull size={28} /> FLAGSHIP ENGAGED <Skull size={28} /></div>
              <div className="w-full h-6 bg-red-950/30 border-2 border-red-600/50 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(255,0,0,0.4)] p-1 backdrop-blur-md">
                  <motion.div animate={{ width: `${bossHealth}%` }} className={`h-full rounded-xl ${bossHealth < 50 ? 'bg-gradient-to-r from-orange-600 to-red-600' : 'bg-gradient-to-r from-red-700 via-red-500 to-red-700'}`} />
              </div>
          </div>
      )}

      <div className="absolute top-10 left-10 flex flex-col gap-2">
        <div className="flex items-center gap-4"><Zap className="text-primary animate-pulse" size={24} /><span className="text-base font-black tracking-[0.4em] text-primary/70 uppercase italic">Sector {level}</span></div>
        <div className="font-mono text-7xl tracking-tighter text-primary font-black uppercase italic leading-none drop-shadow-2xl">{score.toString().padStart(6, '0')}</div>
        {!gameState.current.boss && (
            <div className="w-96 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10 mt-2 shadow-inner"><motion.div animate={{ width: `${Math.min(100, (score/targetScore)*100)}%` }} className="h-full bg-gradient-to-r from-primary to-accent" /></div>
        )}
      </div>

      <div className="absolute top-10 right-10 flex flex-col gap-4">
        <div className="glass-card p-6 border-r-8 border-r-secondary flex items-center gap-10 shadow-2xl">
            <div className="flex flex-col items-end"><span className="text-xs text-gray-400 uppercase font-black tracking-[0.2em] mb-1">Hull Plating</span><span className="text-4xl font-black text-secondary italic underline decoration-secondary/30">{health}%</span></div>
            <div className="w-56 h-4 bg-black/60 rounded-full overflow-hidden border border-white/10 p-0.5"><motion.div animate={{ width: `${health}%` }} className="h-full rounded-full bg-gradient-to-r from-[#7000ff] to-accent shadow-[0_0_20px_rgba(112,0,255,1)]" /></div>
        </div>
        <div className="glass-card p-4 border-r-8 border-r-amber-400 flex items-center gap-6 shadow-2xl">
            <div className="flex flex-col items-end"><span className="text-[10px] text-gray-400 uppercase font-black tracking-[0.2em]">Fuel Cells</span><span className="text-2xl font-black text-amber-400 italic">{fuel}%</span></div>
            <div className="w-48 h-2 bg-black/60 rounded-full overflow-hidden border border-white/10"><motion.div animate={{ width: `${fuel}%` }} className="h-full rounded-full bg-amber-400" /></div>
        </div>
      </div>


      <AnimatePresence>
        {glitchActive && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[200] bg-purple-950/20 backdrop-blur-md flex items-center justify-center p-10">
                <div className="bg-black/95 border-2 border-primary p-8 rounded-lg font-mono text-primary shadow-[0_0_50px_rgba(0,242,255,0.3)] max-w-xl w-full">
                    <div className="flex justify-between items-center mb-6 border-b border-primary/30 pb-2">
                        <span className="animate-pulse">REALITY_GLITCH.exe [V1.0]</span>
                        <X className="cursor-pointer" onClick={() => { setGlitchActive(false); setIsPaused(false); }} />
                    </div>
                    <p className="mb-4 text-xs text-primary/60">{`> Corrupted sectors detected...`}</p>
                    <p className="mb-8 text-xs text-primary/60">{`> Select variables to override:`}</p>
                    <div className="flex flex-col gap-4">
                        {gameState.current.glitch.options.map((opt, i) => (
                            <button key={i} onClick={() => { opt.effect(); setGlitchActive(false); setIsPaused(false); }} className="p-4 border border-primary/20 hover:bg-primary/10 text-left transition-colors group">
                                <span className="text-primary/40 mr-4">0{i+1}</span> {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>
        )}

        {isPaused && !glitchActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center">
            <div className="glass-card p-16 text-center max-w-lg border-primary/20 shadow-2xl backdrop-blur-3xl">
                {!showAbortConfirm ? (
                  <>
                    <h2 className="text-7xl font-black italic text-primary mb-12 tracking-tighter uppercase">Simulation Stopped</h2>
                    <div className="flex flex-col gap-5">
                        <button onClick={() => setIsPaused(false)} className="btn-primary w-full py-6 text-3xl rounded-[2rem] font-black shadow-primary/20 shadow-xl transition-all hover:scale-105 active:scale-95">RESUME MISSION</button>
                        <button onClick={() => { resetGame(); }} className="glass-card w-full py-5 text-xl rounded-[1.5rem] font-black border-white/10 hover:bg-white/10 uppercase tracking-widest text-primary flex items-center justify-center gap-3 transition-colors"><RefreshCcw size={24} /> RESTART MISSION</button>
                        <button onClick={() => { onOpenSettings(); }} className="glass-card w-full py-5 text-xl rounded-[1.5rem] font-black border-white/10 hover:bg-white/10 uppercase tracking-widest text-secondary flex items-center justify-center gap-3 transition-colors"><Settings size={24} /> CONFIGURATION</button>
                        <button onClick={() => setShowAbortConfirm(true)} className="glass-card w-full py-5 text-xl rounded-[1.5rem]text-red-500/40 hover:text-red-500 transition-colors uppercase tracking-[0.5em] text-[10px] font-black  flex items-center justify-center gap-2 pr-6"><Home size={14}/> go to home</button>
                    </div>
                  </> 
                ) : (
                  <>
                    <h2 className="text-5xl font-black italic text-red-500 mb-8 tracking-tighter uppercase drop-shadow-lg">Abort Mission?</h2>
                    <p className="text-gray-400 mb-8 text-sm font-bold uppercase tracking-widest">All current sector progress will be lost.</p>
                    <div className="flex gap-4">
                        <button onClick={onQuit} className="flex-1 btn-primary py-5 rounded-2xl flex items-center justify-center gap-3 text-xl font-black uppercase tracking-widest bg-red-600 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]">Confirm</button>
                        <button onClick={() => setShowAbortConfirm(false)} className="flex-1 glass-card py-5 rounded-2xl font-black uppercase text-xs tracking-widest border-white/5 hover:text-white transition-colors">Cancel</button>
                    </div>
                  </>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShootingGame;
