import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- CONFIGURATION ---
const GRAVITY = 0.4;
const JUMP_STRENGTH = -7;
const PIPE_SPEED = 3;
const PIPE_SPAWN_RATE = 1500;
const GAP = 170;
const HITBOX_RADIUS = 14;

// Inject Pixeloid Font
const pixelFont = `
@font-face {
  font-family: 'Pixeloid';
  src: url('/PixeloidSans-Bold.ttf') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: block;
}

.pixel-crisp {
  font-family: 'Pixeloid', monospace;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeSpeed;
  image-rendering: pixelated;
  letter-spacing: 2px;
}
`;

const FlappyBird = () => {
  const [gameState, setGameState] = useState('START'); // START | COUNTDOWN | PLAYING | GAMEOVER | MENU_REVEAL
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [birdPos, setBirdPos] = useState(300);
  const [birdVelocity, setBirdVelocity] = useState(0);
  const [pipes, setPipes] = useState([]);
  const [count, setCount] = useState(3);
  const [countText, setCountText] = useState('GET READY');
  const [revealedContent, setRevealedContent] = useState(null);

  const containerRef = useRef(null);
  const [gameWidth, setGameWidth] = useState(400);
  const [gameHeight, setGameHeight] = useState(700);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const requestRef = useRef(null);
  const birdPosRef = useRef(birdPos);
  const birdVelocityRef = useRef(birdVelocity);
  const gameStateRef = useRef(gameState);
  const pipesRef = useRef(pipes);
  const spawnIntervalRef = useRef(null);
  const countdownRef = useRef(null);
  const gameWidthRef = useRef(gameWidth);
  const gameHeightRef = useRef(gameHeight);

  useEffect(() => { birdPosRef.current = birdPos; }, [birdPos]);
  useEffect(() => { birdVelocityRef.current = birdVelocity; }, [birdVelocity]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { pipesRef.current = pipes; }, [pipes]);
  useEffect(() => { gameWidthRef.current = gameWidth; }, [gameWidth]);
  useEffect(() => { gameHeightRef.current = gameHeight; }, [gameHeight]);

  const jumpSound = useRef(
    typeof Audio !== 'undefined' ? new Audio('/nenjil_cet.mp3') : null
  );

  // --- DIMENSIONS ---
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setGameWidth(width);
        setGameHeight(height);
      }
    };

    const orientationMedia = window.matchMedia('(orientation: landscape)');
    const handleOrientationChange = (e) => setIsLandscape(e.matches);

    const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsMobile(mobile);
    setIsLandscape(orientationMedia.matches);

    orientationMedia.addEventListener('change', handleOrientationChange);

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    updateDimensions();

    return () => {
      orientationMedia.removeEventListener('change', handleOrientationChange);
      resizeObserver.disconnect();
    };
  }, []);

  // --- START BUTTON ---
  const startGame = () => {
    startCountdown();
  };

  // --- TAP HANDLER ---
  const handleTap = () => {
    if (gameStateRef.current === 'PLAYING') {
      jump();
    }
  };

  // --- END GAME ---
  const endGame = useCallback(() => {
    setGameState('GAMEOVER');
    setBestScore((prev) => Math.max(prev, score));
    cancelAnimationFrame(requestRef.current);
    clearInterval(spawnIntervalRef.current);
  }, [score]);

  // --- GAME LOOP ---
  const gameLoop = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;

    const currentPos = birdPosRef.current;
    const currentVel = birdVelocityRef.current;
    const currentPipes = pipesRef.current;
    const height = gameHeightRef.current;

    const newVel = currentVel + GRAVITY;
    const newPos = currentPos + newVel;

    let isDead = false;

    if (newPos > height - 60 || newPos < 0) isDead = true;

    const birdLeft = 80;
    let scoreToAdd = 0;

    const updatedPipes = currentPipes
      .map((pipe) => {
        const newX = pipe.x - PIPE_SPEED;
        let passed = pipe.passed;

        if (!passed && newX + 85 < birdLeft) {
          passed = true;
          scoreToAdd += 10000; // +10000 per pipe
        }

        return { ...pipe, x: newX, passed };
      })
      .filter((pipe) => pipe.x > -120);

    updatedPipes.forEach((pipe) => {
      const horizontalHit =
        birdLeft + HITBOX_RADIUS > pipe.x &&
        birdLeft - HITBOX_RADIUS < pipe.x + 85;

      if (horizontalHit) {
        const hitTop = newPos - HITBOX_RADIUS < pipe.topHeight;
        const hitBottom = newPos + HITBOX_RADIUS > pipe.topHeight + GAP;
        if (hitTop || hitBottom) isDead = true;
      }
    });

    if (isDead) {
      endGame();
      return;
    }

    setBirdVelocity(newVel);
    setBirdPos(newPos);
    setPipes(updatedPipes);
    if (scoreToAdd > 0) setScore((s) => s + scoreToAdd);

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [endGame]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, gameLoop]);

  // --- PIPE SPAWNER ---
  useEffect(() => {
    if (gameState === 'PLAYING') {
      spawnIntervalRef.current = setInterval(() => {
        const minHeight = 120;
        const maxHeight = gameHeightRef.current - 350;
        const randomHeight =
          Math.random() * (maxHeight - minHeight) + minHeight;

        setPipes((prev) => [
          ...prev,
          { x: gameWidthRef.current, topHeight: randomHeight, passed: false },
        ]);
      }, PIPE_SPAWN_RATE);
    }
    return () => clearInterval(spawnIntervalRef.current);
  }, [gameState]);

  // --- JUMP ---
  const jump = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    setBirdVelocity(JUMP_STRENGTH);

    if (jumpSound.current) {
      jumpSound.current.currentTime = 0;
      jumpSound.current.play().catch(() => {});
    }
  }, []);

  // --- KEYBOARD ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (gameStateRef.current === 'PLAYING') jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump]);

  // --- COUNTDOWN ---
  const startCountdown = () => {
    setGameState('COUNTDOWN');
    setScore(0);
    setBirdPos(gameHeightRef.current / 2);
    setBirdVelocity(0);
    setPipes([]);
    setCount(3);
    setCountText('PRO-SHOW HAS BEEN CANCELLED');

    clearInterval(countdownRef.current);

    let counter = 3;
    countdownRef.current = setInterval(() => {
      counter--;
      setCount(counter);

      if (counter === 2) setCountText('ITS BEEN 3 THREE MONTHS');
      if (counter === 1) setCountText('LET THE REFUND BEGIN!');

      if (counter <= 0) {
        clearInterval(countdownRef.current);
        setGameState('PLAYING');
        setBirdVelocity(JUMP_STRENGTH);
      }
    }, 1000);
  };

  // --- MENU REVEAL (WITH BLAME GSEC) ---
  const triggerReveal = (type) => {
    setRevealedContent(type);
    setGameState('MENU_REVEAL');
  };

  const closeReveal = () => {
    setRevealedContent(null);
    setGameState('GAMEOVER');
  };

  const buttonStyle = (color) => ({
    background: color,
    border: 'none',
    padding: '16px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'white',
    borderRadius: '10px',
    cursor: 'pointer',
  });

  const overlayStyle = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    textAlign: 'center',
    color: 'white',
  };

  const cardStyle = {
    background: '#fff',
    padding: '30px',
    borderRadius: '16px',
    width: '85%',
    maxWidth: '360px',
    color: '#000',
  };

  if (isMobile && isLandscape) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a2e',
        color: 'white',
        textAlign: 'center',
      }}>
        <h2>Rotate to Portrait Mode to Play</h2>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1a1a2e',
      overflow: 'hidden',
    }}>
      <style>{pixelFont}</style>

      <div
        ref={containerRef}
        onClick={handleTap}
        style={{
          position: 'relative',
          width: 'min(100%, 400px)',
          aspectRatio: '9 / 16',
          backgroundColor: '#70c5ce',
          overflow: 'hidden',
          fontFamily: 'Pixeloid, Arial, sans-serif',
          userSelect: 'none',
        }}
      >
        {/* START SCREEN WITH TITLE IMAGE */}
        {gameState === 'START' && (
          <div style={overlayStyle}>
            <div>
              <img
                src="/title.png"
                alt="Title"
                style={{
                  width: '280px',
                  marginBottom: '30px',
                  objectFit: 'contain',
                }}
              />
              <button
                onClick={startGame}
                style={{ ...buttonStyle('#2ecc71'), width: '220px' }}
              >
                ▶ PLAY
              </button>
            </div>
          </div>
        )}

        {/* COUNTDOWN */}
        {gameState === 'COUNTDOWN' && (
          <div style={overlayStyle}>
            <div>
              <h1 style={{ fontSize: '3rem' }}>{count}</h1>
              <p>{countText}</p>
            </div>
          </div>
        )}

        {/* GAME OVER WITH BLAME GSEC + LEADERBOARD */}
        {gameState === 'GAMEOVER' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <h2 style={{ margin: 0, color: '#e74c3c' }}>GAME OVER</h2>

              <div style={{ margin: '15px 0' }}>
                <div>Refund: {score}</div>
                <div>Total Refund: {bestScore}</div>
              </div>

              <button
                onClick={startGame}
                style={{ ...buttonStyle('#2ecc71'), width: '100%' }}
              >
                ⟳ RETRY
              </button>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  onClick={() => triggerReveal('BLAME')}
                  style={{ ...buttonStyle('#e67e22'), flex: 1 }}
                >
                  BLAME G SEC
                </button>

                <button
                  onClick={() => triggerReveal('LEADERBOARD')}
                  style={{ ...buttonStyle('#3498db'), flex: 1 }}
                >
                  RANKINGS
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CINEMATIC REVEAL */}
        {gameState === 'MENU_REVEAL' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ flex: 1, background: '#2c3e50', animation: 'slideUp 0.5s forwards 0.2s' }} />

            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <div style={cardStyle}>
                {revealedContent === 'BLAME' ? (
                  <img
                    src="/gsec.png"
                    alt="G Sec"
                    style={{
                      width: 220,
                      height: 220,
                      objectFit: 'contain',
                      margin: '10px auto',
                      display: 'block',
                    }}
                  />
                ) : (
                  <>
                    <h2>LEADERBOARD</h2>
                    <ul style={{ listStyle: 'none', padding: 0, fontSize: '18px' }}>
                      <li>1. YOU - {score}</li>
                      <li>2. Nandu - 67</li>
                      <li>3. Kanika - 60</li>
                    </ul>
                  </>
                )}

                <button
                  onClick={closeReveal}
                  style={{ ...buttonStyle('#e74c3c'), width: '100%', marginTop: '10px' }}
                >
                  CLOSE
                </button>
              </div>
            </div>

            <div style={{ flex: 1, background: '#2c3e50', animation: 'slideDown 0.5s forwards 0.2s' }} />

            <style>{`
              @keyframes slideUp { to { transform: translateY(-100%); } }
              @keyframes slideDown { to { transform: translateY(100%); } }
            `}</style>
          </div>
        )}

        {/* SCORE HUD */}
        {gameState === 'PLAYING' && (
          <div style={{
            position: 'absolute',
            top: 15,
            left: 15,
            fontSize: '1.5rem',
            color: '#ff2a2a',
            zIndex: 50,
          }}>
            REFUND: {score}
          </div>
        )}

        {/* BIRD */}
        <div style={{
          position: 'absolute',
          left: 80,
          top: birdPos,
          width: 60,
          height: 60,
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
        }}>
          <img
            src="/bird.png"
            alt="Bird"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* PIPES */}
        {pipes.map((pipe, i) => {
          const PIPE_WIDTH = 85;
          const PIPE_HEIGHT = 385;

          return (
            <React.Fragment key={i}>
              <img
                src="/pipe.png"
                alt="Top Pipe"
                style={{
                  position: 'absolute',
                  left: pipe.x,
                  bottom: gameHeight - pipe.topHeight,
                  width: PIPE_WIDTH,
                  height: PIPE_HEIGHT,
                  transform: 'scaleY(-1)',
                  objectFit: 'contain',
                }}
              />
              <img
                src="/pipe.png"
                alt="Bottom Pipe"
                style={{
                  position: 'absolute',
                  left: pipe.x,
                  top: pipe.topHeight + GAP,
                  width: PIPE_WIDTH,
                  height: PIPE_HEIGHT,
                  objectFit: 'contain',
                }}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default FlappyBird;
