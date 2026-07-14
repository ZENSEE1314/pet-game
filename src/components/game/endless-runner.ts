import type { PhaserGameFactory } from './GameShell';

/**
 * Endless Runner.
 *
 * The pet runs automatically; the player jumps over obstacles and grabs coins. Speed
 * ramps with distance. All art is drawn with Phaser Graphics — no sprite sheets, no
 * asset licensing, and the whole game is one file that ships in the bundle.
 *
 * The score this reports is a *claim*. The server independently checks it against the
 * session duration and the configured ceilings before it becomes money.
 */

const WORLD = { width: 800, height: 500 };
const GROUND_Y = 420;
const GRAVITY = 1800;
const JUMP_VELOCITY = -700;
const START_SPEED = 300;
const MAX_SPEED = 700;
const SPEED_RAMP = 6; // px/s gained per second survived

export const createEndlessRunner: PhaserGameFactory = async (parent, callbacks) => {
  // Phaser is ~1MB and touches `window` at import time, so it must never be part of
  // the server bundle. The dynamic import keeps it out of the initial page payload
  // too — the lobby loads instantly, the game chunk arrives when you press Start.
  const Phaser = (await import('phaser')).default;

  class RunnerScene extends Phaser.Scene {
    private pet!: Phaser.GameObjects.Container;
    private petBody!: Phaser.Physics.Arcade.Body;
    private obstacles!: Phaser.Physics.Arcade.Group;
    private coins!: Phaser.Physics.Arcade.Group;
    private ground!: Phaser.GameObjects.Rectangle;

    private score = 0;
    private distance = 0;
    private coinsCollected = 0;
    private obstaclesCleared = 0;
    private speed = START_SPEED;
    private lives = 3;
    private isOver = false;

    private scoreText!: Phaser.GameObjects.Text;
    private livesText!: Phaser.GameObjects.Text;
    private spawnTimer = 0;
    private coinTimer = 0;

    constructor() {
      super({ key: 'runner' });
    }

    create() {
      this.cameras.main.setBackgroundColor('#1e1b4b');

      // Parallax hills, cheapest possible depth cue.
      for (let i = 0; i < 5; i += 1) {
        this.add
          .circle(i * 200 + 60, GROUND_Y, 90, 0x312e81)
          .setAlpha(0.6)
          .setDepth(0);
      }

      this.ground = this.add.rectangle(
        WORLD.width / 2,
        GROUND_Y + 40,
        WORLD.width,
        80,
        0x4c1d95,
      );
      this.physics.add.existing(this.ground, true);

      this.pet = this.createPet(120, GROUND_Y - 30);
      this.physics.add.existing(this.pet);
      this.petBody = this.pet.body as Phaser.Physics.Arcade.Body;
      this.petBody.setSize(44, 44);
      this.petBody.setCollideWorldBounds(true);
      this.petBody.setGravityY(GRAVITY);

      this.physics.add.collider(this.pet, this.ground);

      this.obstacles = this.physics.add.group();
      this.coins = this.physics.add.group();

      this.physics.add.overlap(this.pet, this.obstacles, this.hitObstacle, undefined, this);
      this.physics.add.overlap(this.pet, this.coins, this.collectCoin, undefined, this);

      this.scoreText = this.add
        .text(WORLD.width - 20, 20, '0', {
          fontSize: '28px',
          fontFamily: 'system-ui, sans-serif',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0)
        .setDepth(10);

      this.livesText = this.add
        .text(20, 20, '❤❤❤', { fontSize: '22px', color: '#f87171' })
        .setDepth(10);

      // Keyboard AND touch, both bound to the same action. A mobile player who has to
      // find a virtual d-pad has already lost the run.
      this.input.keyboard?.on('keydown-SPACE', this.jump, this);
      this.input.keyboard?.on('keydown-UP', this.jump, this);
      this.input.keyboard?.on('keydown-W', this.jump, this);
      this.input.on('pointerdown', this.jump, this);
    }

    private createPet(x: number, y: number) {
      const container = this.add.container(x, y);

      const body = this.add.circle(0, 0, 22, 0xa78bfa);
      const belly = this.add.circle(0, 6, 13, 0xffffff).setAlpha(0.3);
      const earLeft = this.add.ellipse(-14, -20, 12, 20, 0x8b5cf6);
      const earRight = this.add.ellipse(14, -20, 12, 20, 0x8b5cf6);
      const eyeLeft = this.add.circle(-7, -4, 4, 0x312e81);
      const eyeRight = this.add.circle(7, -4, 4, 0x312e81);

      container.add([earLeft, earRight, body, belly, eyeLeft, eyeRight]);
      container.setDepth(5);
      return container;
    }

    private jump() {
      if (this.isOver) return;
      // Grounded check: no double-jumping, no flying over the whole level.
      if (this.petBody.blocked.down || this.petBody.touching.down) {
        this.petBody.setVelocityY(JUMP_VELOCITY);
      }
    }

    private hitObstacle(_pet: unknown, obstacleObj: unknown) {
      const obstacle = obstacleObj as Phaser.GameObjects.Rectangle & {
        getData: (key: string) => unknown;
        setData: (key: string, value: unknown) => void;
      };

      if (obstacle.getData('hit')) return; // one hit per obstacle, not one per frame
      obstacle.setData('hit', true);

      this.lives -= 1;
      this.livesText.setText('❤'.repeat(Math.max(0, this.lives)));

      this.cameras.main.shake(180, 0.012);
      this.cameras.main.flash(120, 255, 80, 80);

      if (this.lives <= 0) this.endGame();
    }

    private collectCoin(_pet: unknown, coinObj: unknown) {
      const coin = coinObj as Phaser.GameObjects.Arc;
      coin.destroy();

      this.coinsCollected += 1;
      this.score += 10;
    }

    private spawnObstacle() {
      const height = Phaser.Math.Between(40, 80);
      const obstacle = this.add.rectangle(
        WORLD.width + 40,
        GROUND_Y - height / 2,
        34,
        height,
        0xef4444,
      );

      this.physics.add.existing(obstacle);
      const body = obstacle.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.setImmovable(true);

      this.obstacles.add(obstacle);
    }

    private spawnCoin() {
      const y = Phaser.Math.Between(GROUND_Y - 160, GROUND_Y - 60);
      const coin = this.add.circle(WORLD.width + 40, y, 12, 0xfbbf24);
      coin.setStrokeStyle(3, 0xd97706);

      this.physics.add.existing(coin);
      const body = coin.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);

      this.coins.add(coin);
    }

    update(_time: number, delta: number) {
      if (this.isOver) return;

      const deltaSeconds = delta / 1000;

      // Difficulty ramps with survival time, capped so the game stays playable.
      this.speed = Math.min(MAX_SPEED, this.speed + SPEED_RAMP * deltaSeconds);
      this.distance += this.speed * deltaSeconds;

      // 1 point per 10px travelled, plus 10 per coin. The server knows this formula
      // too — that's how it decides whether a submitted score is physically possible.
      this.score = Math.floor(this.distance / 10) + this.coinsCollected * 10;
      this.scoreText.setText(String(this.score));
      callbacks.onScoreChange(this.score);

      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.spawnObstacle();
        // Gaps shrink as speed rises, but never below a jumpable minimum.
        this.spawnTimer = Phaser.Math.Between(900, 1600) * (START_SPEED / this.speed);
      }

      this.coinTimer -= delta;
      if (this.coinTimer <= 0) {
        this.spawnCoin();
        this.coinTimer = Phaser.Math.Between(700, 1500);
      }

      for (const child of this.obstacles.getChildren()) {
        const obstacle = child as Phaser.GameObjects.Rectangle;
        const body = obstacle.body as Phaser.Physics.Arcade.Body;
        body.setVelocityX(-this.speed);

        if (obstacle.x < -60) {
          if (!obstacle.getData('hit')) this.obstaclesCleared += 1;
          obstacle.destroy();
        }
      }

      for (const child of this.coins.getChildren()) {
        const coin = child as Phaser.GameObjects.Arc;
        const body = coin.body as Phaser.Physics.Arcade.Body;
        body.setVelocityX(-this.speed);
        if (coin.x < -40) coin.destroy();
      }
    }

    private endGame() {
      if (this.isOver) return;
      this.isOver = true;

      this.physics.pause();

      callbacks.onGameOver(this.score, {
        coinsCollected: this.coinsCollected,
        obstaclesCleared: this.obstaclesCleared,
        distance: Math.floor(this.distance),
        livesLost: 3,
      });
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WORLD.width,
    height: WORLD.height,
    transparent: false,
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: RunnerScene,
  });

  return {
    destroy: () => game.destroy(true),
    pause: () => game.scene.pause('runner'),
    resume: () => game.scene.resume('runner'),
  };
};
