import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- CONFIGURATION ---
const GRAVITY = 0.6;
const JUMP_STRENGTH = -8;
const PIPE_SPEED = 3;
const PIPE_SPAWN_RATE = 1500;
const GAP = 170;
const HITBOX_RADIUS = 24;
const CAP_HEIGHT = 30; // Height of the pipe's cap in your image (adjust as needed)

const FlappyBird = () => {
  // --- STATE ---
  const [gameState, setGameState] = useState('START');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [birdPos, setBirdPos] = useState(300);
  const [birdVelocity, setBirdVelocity] = useState(0);
  const [pipes, setPipes] = useState([]);
  const [count, setCount] = useState(3);
  const [countText, setCountText] = useState('GET READY');
  const [revealedContent, setRevealedContent] = useState(null);

  // --- DIMENSIONS & ORIENTATION ---
  const containerRef = useRef(null);
  const [gameWidth, setGameWidth] = useState(400);
  const [gameHeight, setGameHeight] = useState(700);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // --- REFS ---
  const requestRef = useRef(null);
  const birdPosRef = useRef(birdPos);
  const birdVelocityRef = useRef(birdVelocity);
  const gameStateRef = useRef(gameState);
  const pipesRef = useRef(pipes);
  const spawnIntervalRef = useRef(null);
  const countdownRef = useRef(null);
  const gameWidthRef = useRef(gameWidth);
  const gameHeightRef = useRef(gameHeight);

  // Sync state to refs
  useEffect(() => { birdPosRef.current = birdPos; }, [birdPos]);
  useEffect(() => { birdVelocityRef.current = birdVelocity; }, [birdVelocity]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { pipesRef.current = pipes; }, [pipes]);
  useEffect(() => { gameWidthRef.current = gameWidth; }, [gameWidth]);
  useEffect(() => { gameHeightRef.current = gameHeight; }, [gameHeight]);

  // AUDIO
  const jumpSound = useRef(
    typeof Audio !== 'undefined' ? new Audio('/nenjil_cet.mp3') : null
  );

  // --- DIMENSIONS & ORIENTATION LISTENERS ---
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

    // Detect mobile (simple UA check)
    const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsMobile(mobile);
    setIsLandscape(orientationMedia.matches);

    orientationMedia.addEventListener('change', handleOrientationChange);

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    // Initial measure
    updateDimensions();

    return () => {
      orientationMedia.removeEventListener('change', handleOrientationChange);
      resizeObserver.disconnect();
    };
  }, []);

  // --- END GAME ---
  const endGame = useCallback(() => {
    setGameState('GAMEOVER');
    setBestScore((prev) => Math.max(prev, score));
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
  }, [score]);

  // --- GAME LOOP ---
  const gameLoop = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;

    const currentPos = birdPosRef.current;
    const currentVel = birdVelocityRef.current;
    const currentPipes = pipesRef.current;
    const height = gameHeightRef.current;
    const width = gameWidthRef.current;

    const newVel = currentVel + GRAVITY;
    const newPos = currentPos + newVel;

    let isDead = false;

    // 1. Floor / Ceiling
    if (newPos > height - 60 || newPos < 0) {
      isDead = true;
    }

    // 2. Process Pipes & Score
    const birdLeft = 80;
    let scoreToAdd = 0;

    const updatedPipes = currentPipes
      .map((pipe) => {
        const newX = pipe.x - PIPE_SPEED;
        let passed = pipe.passed;

        if (!passed && newX + 70 < birdLeft) {
          passed = true;
          scoreToAdd += 1;
        }

        return { ...pipe, x: newX, passed };
      })
      .filter((pipe) => pipe.x > -100);

    // 3. Collision
    updatedPipes.forEach((pipe) => {
      const horizontalHit =
        birdLeft + HITBOX_RADIUS > pipe.x &&
        birdLeft - HITBOX_RADIUS < pipe.x + 70;

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

  // --- CONTROLS ---
  const jump = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    setBirdVelocity(JUMP_STRENGTH);

    if (jumpSound.current) {
      jumpSound.current.currentTime = 0;
      jumpSound.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        jump();
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
    setCountText('YOU STOOD FOR ELECTION');

    if (countdownRef.current) clearInterval(countdownRef.current);

    let counter = 3;
    countdownRef.current = setInterval(() => {
      counter--;
      setCount(counter);

      if (counter === 2) setCountText('YOU WON THE ELECTION');
      if (counter === 1) setCountText('LET THE HEIST BEGIN!');

      if (counter <= 0) {
        clearInterval(countdownRef.current);
        setGameState('PLAYING');
        setBirdVelocity(JUMP_STRENGTH);
      }
    }, 1000);
  };

  // --- REVEAL MENU ---
  const triggerReveal = (type) => {
    setRevealedContent(type);
    setGameState('MENU_REVEAL');
  };

  const closeReveal = () => {
    setRevealedContent(null);
    setGameState('GAMEOVER');
  };

  // --- ROTATE WARNING (only on mobile landscape) ---
  if (isMobile && isLandscape) {
    return (
      <div style={rotateOverlayStyle}>
        <div style={rotateMessageStyle}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>↻</div>
          <h2>Please rotate your device to portrait mode</h2>
          <p>This game is designed for vertical play.</p>
        </div>
      </div>
    );
  }

  // --- MAIN GAME (portrait container) ---
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a2e',
        overflow: 'hidden',
      }}
    >
      <div
        ref={containerRef}
        onClick={jump}
        style={{
          position: 'relative',
          width: 'min(100%, 400px)',
          aspectRatio: '9 / 16',
          backgroundColor: '#70c5ce',
          overflow: 'hidden',
          fontFamily: 'Arial, sans-serif',
          userSelect: 'none',
          boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        }}
      >
        {/* BIRD */}
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: birdPos,
            width: '80px',
            height: '80px',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
          }}
        >
          <img
            src="/bird.png"
            alt="Bird"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
        {/* PIPES - Single image, no stretching */}
        {pipes.map((pipe, i) => {
          const PIPE_WIDTH = 85;      // match your PNG width
          const PIPE_HEIGHT = 382;    // IMPORTANT: set this to your actual pipe.png height

          return (
            <React.Fragment key={i}>
              {/* TOP PIPE (flipped, anchored to gap) */}
              <img
                src="/pipe.png"
                alt="Top Pipe"
                style={{
                  position: 'absolute',
                  left: pipe.x,
                  bottom: gameHeight - pipe.topHeight,
                  width: `${PIPE_WIDTH}px`,
                  height: `${PIPE_HEIGHT}px`,
                  transform: 'scaleY(-1)',
                  objectFit: 'contain',
                  pointerEvents: 'none',
                }}
              />

              {/* BOTTOM PIPE (normal, anchored to gap) */}
              <img
                src="/pipe.png"
                alt="Bottom Pipe"
                style={{
                  position: 'absolute',
                  left: pipe.x,
                  top: pipe.topHeight + GAP,
                  width: `${PIPE_WIDTH}px`,
                  height: `${PIPE_HEIGHT}px`,
                  objectFit: 'contain',
                  pointerEvents: 'none',
                }}
              />
            </React.Fragment>
          );
        })}

        {/* SCORE */}
        {gameState === 'PLAYING' && (
          <div
            style={{
              position: 'absolute',
              top: 40,
              width: '100%',
              textAlign: 'center',
              fontSize: 'clamp(3rem, 10vw, 5rem)',
              color: 'white',
              fontWeight: 'bold',
              textShadow: '3px 3px 0 #000',
              zIndex: 20,
            }}
          >
            {score}
          </div>
        )}

        {/* START SCREEN */}
        {gameState === 'START' && (
          <div style={overlayStyle}>
            <img src="/title.png" alt="Title" style={{ width: '90%', maxWidth: '400px' }} />
            <button onClick={startCountdown} style={buttonStyle('#ff2929')}>
              ▶ PLAY
            </button>
          </div>
        )}

        {/* COUNTDOWN */}
        {gameState === 'COUNTDOWN' && (
          <div style={overlayStyle}>
            <div style={countStyle}>{count}</div>
            <div style={countTextStyle}>{countText}</div>
          </div>
        )}

        {/* GAME OVER */}
        {gameState === 'GAMEOVER' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <h2 style={{ margin: 0, color: '#ff1900' }}>GAME OVER</h2>
              <div style={{ margin: '15px 0' }}>
                <div>SCORE: {score}</div>
                <div>BEST: {bestScore}</div>
              </div>

              <button onClick={startCountdown} style={{ ...buttonStyle('#2ecc71'), width: '100%' }}>
                ⟳ RETRY
              </button>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => triggerReveal('BLAME')} style={{ ...buttonStyle('#e67e22'), flex: 1, minWidth: '120px' }}>
                  BLAME G SEC
                </button>
                <button onClick={() => triggerReveal('LEADERBOARD')} style={{ ...buttonStyle('#3498db'), flex: 1, minWidth: '120px' }}>
                  RANKINGS
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REVEAL SCREEN */}
        {gameState === 'MENU_REVEAL' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              {revealedContent === 'BLAME' ? (
                <img
                  src="/gsec.png"
                  alt="G Sec"
                  style={{
                    width: '100%',
                    maxHeight: '60vh',
                    objectFit: 'contain',
                    margin: '15px auto',
                    display: 'block',
                  }}
                />
              ) : (
                <>
                  <h2>LEADERBOARD</h2>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    <li>1. π-Forest - 7,00,000</li>
                    <li>2. YOU - {score}</li>
                    <li>3. Nandu - 67</li>
                  </ul>
                </>
              )}
              <button onClick={closeReveal} style={{ ...buttonStyle('#e74c3c'), width: '100%' }}>
                CLOSE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- STYLES ---
const overlayStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '25px',
  zIndex: 50,
  padding: '20px',
  boxSizing: 'border-box',
};

const countStyle = {
  fontSize: 'clamp(4rem, 15vw, 8rem)',
  color: 'white',
  fontWeight: 'bold',
  textShadow: '4px 4px 0 #000',
};

const countTextStyle = {
  fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
  color: '#ffbd29',
  fontWeight: 'bold',
  textAlign: 'center',
  textShadow: '2px 2px 0 #000',
  width: '100%',
};

const cardStyle = {
  background: '#ded895',
  border: '4px solid black',
  padding: '20px',
  borderRadius: '12px',
  textAlign: 'center',
  width: '100%',
  maxWidth: '450px',
  boxSizing: 'border-box',
};

const buttonStyle = (color) => ({
  padding: '12px 20px',
  fontSize: '1.1rem',
  fontWeight: 'bold',
  color: 'white',
  background: color,
  border: '2px solid white',
  borderRadius: '6px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  boxSizing: 'border-box',
});

const rotateOverlayStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100vw',
  height: '100vh',
  backgroundColor: '#1a1a2e',
  color: 'white',
  textAlign: 'center',
};

const rotateMessageStyle = {
  padding: '2rem',
  maxWidth: '400px',
};

export default FlappyBird;