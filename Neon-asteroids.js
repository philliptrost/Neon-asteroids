import React, { useRef, useEffect, useState, useCallback } from 'react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const getRandomBrightColor = () => {
  const hue = Math.random() * 360;
  return `hsl(${hue}, 100%, 50%)`;
};

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.rotation = 0;
    this.vx = 0;
    this.vy = 0;
    this.rotationVelocity = 0;
    this.rotationAcceleration = 0.00900;
    this.maxRotationVelocity = 0.00900;
    this.rotationFriction = 0.98;
    this.thrustPower = 0.0030000;
    this.maxSpeed = 1.25;
    this.bullets = [];
    this.trail = [];
    this.isThrusting = false;
    this.trailLength = 300; // Increased trail length
  }

  rotate(dir) {
    this.rotationVelocity += this.rotationAcceleration * dir;
    if (Math.abs(this.rotationVelocity) > this.maxRotationVelocity) {
      this.rotationVelocity = this.maxRotationVelocity * Math.sign(this.rotationVelocity);
    }
  }

  applyThrust() {
    this.isThrusting = true;
    const acceleration = {
      x: Math.cos(this.rotation) * this.thrustPower,
      y: Math.sin(this.rotation) * this.thrustPower
    };
    this.vx += acceleration.x;
    this.vy += acceleration.y;

    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > this.maxSpeed) {
      const ratio = this.maxSpeed / speed;
      this.vx *= ratio;
      this.vy *= ratio;
    }
  }

  shoot() {
    const bullet = {
      x: this.x + Math.cos(this.rotation) * 20,
      y: this.y + Math.sin(this.rotation) * 20,
      vx: Math.cos(this.rotation) * 2 + this.vx,
      vy: Math.sin(this.rotation) * 2 + this.vy,
    };
    this.bullets.push(bullet);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotationVelocity;
    this.rotationVelocity *= this.rotationFriction;

    this.x = (this.x + CANVAS_WIDTH) % CANVAS_WIDTH;
    this.y = (this.y + CANVAS_HEIGHT) % CANVAS_HEIGHT;

    this.bullets = this.bullets.filter(bullet => {
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      return (
        bullet.x > 0 && bullet.x < CANVAS_WIDTH &&
        bullet.y > 0 && bullet.y < CANVAS_HEIGHT
      );
    });

    if (this.isThrusting) {
      this.trail.push({
        x: this.x - Math.cos(this.rotation) * 20,
        y: this.y - Math.sin(this.rotation) * 20,
        age: 0
      });
    }
    
    this.trail = this.trail.filter(point => {
      point.age += 1;
      return point.age < this.trailLength;
    });

    this.isThrusting = false;
  }

  draw(ctx) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'white';
    this.trail.forEach((point) => {
      ctx.globalAlpha = 1 - point.age / this.trailLength;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fillStyle = 'white';
    ctx.fill();

    if (this.isThrusting) {
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-20, -5);
      ctx.lineTo(-30, 0);
      ctx.lineTo(-20, 5);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(-10, 0, -30, 0);
      gradient.addColorStop(0, 'yellow');
      gradient.addColorStop(0.5, 'orange');
      gradient.addColorStop(1, 'red');
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    ctx.restore();

    ctx.fillStyle = 'white';
    this.bullets.forEach(bullet => {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

class Asteroid {
  constructor(x, y, size, color = null) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.speed = Math.random() * 0.1 + 0.02;
    this.angle = Math.random() * Math.PI * 2;
    this.vertices = this.generateVertices();
    this.color = color || getRandomBrightColor();
  }

  generateVertices() {
    const vertices = [];
    const numVertices = Math.floor(Math.random() * 5) + 7;
    for (let i = 0; i < numVertices; i++) {
      const angle = (i / numVertices) * Math.PI * 2;
      const distance = this.size * (0.75 + Math.random() * 0.25);
      vertices.push({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance
      });
    }
    return vertices;
  }

  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    this.x = (this.x + CANVAS_WIDTH) % CANVAS_WIDTH;
    this.y = (this.y + CANVAS_HEIGHT) % CANVAS_HEIGHT;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.beginPath();
    this.vertices.forEach((vertex, index) => {
      if (index === 0) {
        ctx.moveTo(vertex.x, vertex.y);
      } else {
        ctx.lineTo(vertex.x, vertex.y);
      }
    });
    ctx.closePath();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  }
}

const Game = () => {
  const canvasRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [asteroids, setAsteroids] = useState([]);
  const controlsRef = useRef({
    thrust: false,
    rotateLeft: false,
    rotateRight: false,
  });

  const generateInitialAsteroids = useCallback(() => {
    const initialAsteroids = [];
    const shipSafeRadius = 100;
    for (let i = 0; i < 5; i++) {
      let x, y;
      do {
        x = Math.random() * CANVAS_WIDTH;
        y = Math.random() * CANVAS_HEIGHT;
      } while (
        Math.sqrt(
          Math.pow(x - CANVAS_WIDTH / 2, 2) + Math.pow(y - CANVAS_HEIGHT / 2, 2)
        ) < shipSafeRadius
      );
      initialAsteroids.push(new Asteroid(x, y, 40));
    }
    return initialAsteroids;
  }, []);

  const startGame = useCallback(() => {
    setGameStarted(true);
    setScore(0);
    setPlayer(new Player(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2));
    setAsteroids(generateInitialAsteroids());
  }, [generateInitialAsteroids]);

  const handlePointerDown = useCallback((control) => {
    controlsRef.current[control] = true;
  }, []);

  const handlePointerUp = useCallback((control) => {
    controlsRef.current[control] = false;
  }, []);

  const handleShoot = useCallback(() => {
    if (player) {
      player.shoot();
    }
  }, [player]);

  const checkBulletAsteroidCollisions = useCallback(() => {
    if (!player) return;

    const newAsteroids = [];
    let scoreIncrease = 0;

    asteroids.forEach(asteroid => {
      let asteroidHit = false;
      player.bullets = player.bullets.filter(bullet => {
        const dx = bullet.x - asteroid.x;
        const dy = bullet.y - asteroid.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < asteroid.size * asteroid.size) {
          asteroidHit = true;
          scoreIncrease += 50 - asteroid.size;
          return false;
        }
        return true;
      });

      if (asteroidHit) {
        if (asteroid.size > 20) {
          for (let i = 0; i < 2; i++) {
            newAsteroids.push(new Asteroid(asteroid.x, asteroid.y, asteroid.size / 2, asteroid.color));
          }
        }
      } else {
        newAsteroids.push(asteroid);
      }
    });

    setAsteroids(newAsteroids);
    setScore(prevScore => prevScore + scoreIncrease);
  }, [asteroids, player]);

  useEffect(() => {
    if (!gameStarted || !player) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    let animationFrameId;

    const gameLoop = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (controlsRef.current.thrust) {
        player.applyThrust();
      }
      if (controlsRef.current.rotateLeft) {
        player.rotate(-1);
      }
      if (controlsRef.current.rotateRight) {
        player.rotate(1);
      }

      player.update();
      player.draw(ctx);

      asteroids.forEach(asteroid => {
        asteroid.update();
        asteroid.draw(ctx);
      });

      checkBulletAsteroidCollisions();

      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText(`Score: ${score}`, 10, 30);

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameStarted, player, score, asteroids, checkBulletAsteroidCollisions]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border border-white"
      />
      {!gameStarted && (
        <button
          onClick={startGame}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Start Game
        </button>
      )}
      <div className="mt-4 flex space-x-4">
        <button 
          className="p-2 bg-gray-700 rounded" 
          onPointerDown={() => handlePointerDown('thrust')}
          onPointerUp={() => handlePointerUp('thrust')}
          onPointerLeave={() => handlePointerUp('thrust')}
        >
          Thrust
        </button>
        <button 
          className="p-2 bg-gray-700 rounded"
          onPointerDown={() => handlePointerDown('rotateLeft')}
          onPointerUp={() => handlePointerUp('rotateLeft')}
          onPointerLeave={() => handlePointerUp('rotateLeft')}
        >
          Rotate Left
        </button>
        <button 
          className="p-2 bg-gray-700 rounded"
          onPointerDown={() => handlePointerDown('rotateRight')}
          onPointerUp={() => handlePointerUp('rotateRight')}
          onPointerLeave={() => handlePointerUp('rotateRight')}
        >
          Rotate Right
        </button>
        <button 
          className="p-2 bg-gray-700 rounded" 
          onClick={handleShoot}
        >
          Shoot
        </button>
      </div>
    </div>
  );
};

export default Game;
