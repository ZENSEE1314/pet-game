import type { PhaserGameFactory } from './GameShell';

/**
 * Feeding Catch.
 *
 * Food falls; the player slides the pet left and right to catch it. Healthy food
 * scores, rare food scores big, rotten food costs a life. Consecutive catches build a
 * combo multiplier — which is what makes the game about rhythm rather than reflexes.
 *
 * Fixed 60-second round, so `duration` is a strong anti-cheat signal: a submission
 * claiming a huge score after eight seconds did not happen.
 */

const WORLD = { width: 800, height: 500 };
const ROUND_SECONDS = 60;
const PET_Y = 430;
const PET_SPEED = 520;

interface FoodKind {
  colour: number;
  radius: number;
  points: number;
  isHazard: boolean;
  weight: number;
}

const FOODS: FoodKind[] = [
  { colour: 0x22c55e, radius: 16, points: 10, isHazard: false, weight: 55 }, // healthy
  { colour: 0xfbbf24, radius: 18, points: 25, isHazard: false, weight: 22 }, // tasty
  { colour: 0xec4899, radius: 20, points: 60, isHazard: false, weight: 8 }, // rare
  { colour: 0x64748b, radius: 16, points: -20, isHazard: true, weight: 15 }, // rotten
];

function pickFood(random: () => number): FoodKind {
  const total = FOODS.reduce((sum, food) => sum + food.weight, 0);
  let roll = random() * total;
  for (const food of FOODS) {
    roll -= food.weight;
    if (roll <= 0) return food;
  }
  return FOODS[0]!;
}

export const createFeedingCatch: PhaserGameFactory = async (parent, callbacks) => {
  const Phaser = (await import('phaser')).default;

  class CatchScene extends Phaser.Scene {
    private pet!: Phaser.GameObjects.Container;
    private petBody!: Phaser.Physics.Arcade.Body;
    private foods!: Phaser.Physics.Arcade.Group;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    private score = 0;
    private combo = 0;
    private maxCombo = 0;
    private lives = 3;
    private itemsCaught = 0;
    private timeLeft = ROUND_SECONDS;
    private spawnTimer = 0;
    private isOver = false;
    private pointerTargetX: number | null = null;

    private scoreText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private timerText!: Phaser.GameObjects.Text;
    private livesText!: Phaser.GameObjects.Text;

    constructor() {
      super({ key: 'catch' });
    }

    create() {
      this.cameras.main.setBackgroundColor('#0c4a6e');

      this.add.rectangle(WORLD.width / 2, 480, WORLD.width, 40, 0x075985);

      this.pet = this.createPet(WORLD.width / 2, PET_Y);
      this.physics.add.existing(this.pet);
      this.petBody = this.pet.body as Phaser.Physics.Arcade.Body;
      this.petBody.setSize(70, 50);
      this.petBody.setAllowGravity(false);
      this.petBody.setCollideWorldBounds(true);

      this.foods = this.physics.add.group();
      this.physics.add.overlap(this.pet, this.foods, this.catchFood, undefined, this);

      const style = {
        fontSize: '22px',
        fontFamily: 'system-ui, sans-serif',
        color: '#ffffff',
        fontStyle: 'bold',
      };

      this.scoreText = this.add.text(20, 18, '0', { ...style, fontSize: '28px' }).setDepth(10);
      this.timerText = this.add
        .text(WORLD.width / 2, 18, `${ROUND_SECONDS}`, { ...style, fontSize: '28px' })
        .setOrigin(0.5, 0)
        .setDepth(10);
      this.livesText = this.add
        .text(WORLD.width - 20, 18, '❤❤❤', { fontSize: '22px', color: '#f87171' })
        .setOrigin(1, 0)
        .setDepth(10);
      this.comboText = this.add
        .text(20, 52, '', { fontSize: '18px', color: '#fbbf24', fontStyle: 'bold' })
        .setDepth(10);

      this.cursors = this.input.keyboard!.createCursorKeys();

      // Touch: drag anywhere to steer. Tapping a fixed on-screen button would put the
      // player's thumb over the thing they're trying to catch.
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (pointer.isDown || pointer.wasTouch) this.pointerTargetX = pointer.worldX;
      });
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.pointerTargetX = pointer.worldX;
      });
      this.input.on('pointerup', () => {
        this.pointerTargetX = null;
      });

      this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => {
          if (this.isOver) return;
          this.timeLeft -= 1;
          this.timerText.setText(String(Math.max(0, this.timeLeft)));
          if (this.timeLeft <= 0) this.endGame();
        },
      });
    }

    private createPet(x: number, y: number) {
      const container = this.add.container(x, y);

      const bowl = this.add.ellipse(0, 14, 78, 26, 0xf1f5f9);
      const body = this.add.circle(0, -8, 24, 0xa78bfa);
      const earLeft = this.add.ellipse(-15, -28, 12, 20, 0x8b5cf6);
      const earRight = this.add.ellipse(15, -28, 12, 20, 0x8b5cf6);
      const eyeLeft = this.add.circle(-8, -12, 4, 0x312e81);
      const eyeRight = this.add.circle(8, -12, 4, 0x312e81);
      const mouth = this.add.ellipse(0, -2, 14, 8, 0x312e81);

      container.add([earLeft, earRight, body, eyeLeft, eyeRight, mouth, bowl]);
      container.setDepth(5);
      return container;
    }

    private spawnFood() {
      const kind = pickFood(() => Math.random());
      const x = Phaser.Math.Between(40, WORLD.width - 40);

      const food = this.add.circle(x, -30, kind.radius, kind.colour);
      food.setStrokeStyle(3, kind.isHazard ? 0x334155 : 0xffffff, 0.6);
      food.setData('kind', kind);

      this.physics.add.existing(food);

      // Join the group BEFORE configuring the body. An Arcade Group applies its
      // `defaults` to every body handed to it — including velocityY: 0 — so a
      // velocity set beforehand is silently wiped, and the food hangs above the
      // canvas forever. This ordering, plus the per-frame re-assert in update(),
      // is what actually makes it fall.
      this.foods.add(food);

      // Fall speed rises as the clock runs down, so the last fifteen seconds are the
      // ones that decide the score. Stored on the object because update() re-applies
      // it every frame rather than trusting it to survive.
      const progress = 1 - this.timeLeft / ROUND_SECONDS;
      const fallSpeed = Phaser.Math.Between(170, 240) + progress * 190;
      food.setData('fallSpeed', fallSpeed);

      const body = food.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.setVelocityY(fallSpeed);
    }

    private catchFood(_pet: unknown, foodObj: unknown) {
      const food = foodObj as Phaser.GameObjects.Arc;
      const kind = food.getData('kind') as FoodKind;
      food.destroy();

      if (kind.isHazard) {
        // A hazard doesn't just cost points — it breaks the combo, which is usually
        // the more expensive half.
        this.lives -= 1;
        this.combo = 0;
        this.score = Math.max(0, this.score + kind.points);
        this.livesText.setText('❤'.repeat(Math.max(0, this.lives)));
        this.comboText.setText('');
        this.cameras.main.shake(150, 0.01);

        if (this.lives <= 0) this.endGame();
        return;
      }

      this.itemsCaught += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      // Multiplier caps at 5×, so a long combo is valuable but not unbounded — an
      // uncapped multiplier is how you end up with a leaderboard of one person.
      const multiplier = Math.min(5, 1 + Math.floor(this.combo / 5));
      this.score += kind.points * multiplier;

      this.comboText.setText(this.combo >= 3 ? `${this.combo}× combo (${multiplier}× score)` : '');
      this.scoreText.setText(String(this.score));
      callbacks.onScoreChange(this.score);
    }

    update(_time: number, delta: number) {
      if (this.isOver) return;

      // Keyboard first, then touch — a player using both isn't fighting themselves.
      if (this.cursors.left.isDown) {
        this.petBody.setVelocityX(-PET_SPEED);
        this.pointerTargetX = null;
      } else if (this.cursors.right.isDown) {
        this.petBody.setVelocityX(PET_SPEED);
        this.pointerTargetX = null;
      } else if (this.pointerTargetX !== null) {
        const dx = this.pointerTargetX - this.pet.x;
        this.petBody.setVelocityX(
          Math.abs(dx) < 6 ? 0 : Math.sign(dx) * Math.min(PET_SPEED, Math.abs(dx) * 9),
        );
      } else {
        this.petBody.setVelocityX(0);
      }

      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.spawnFood();
        const progress = 1 - this.timeLeft / ROUND_SECONDS;
        this.spawnTimer = Phaser.Math.Between(520, 900) - progress * 260;
      }

      for (const child of this.foods.getChildren()) {
        const food = child as Phaser.GameObjects.Arc;

        // Re-assert the fall speed every frame, the same way the runner drives its
        // obstacles. Anything that resets a body — a group default, a physics restart,
        // a pause/resume — cannot leave food frozen in mid-air.
        const body = food.body as Phaser.Physics.Arcade.Body | null;
        const fallSpeed = (food.getData('fallSpeed') as number) ?? 200;
        if (body && body.velocity.y !== fallSpeed) {
          body.setVelocityY(fallSpeed);
        }

        if (food.y > WORLD.height + 40) {
          const kind = food.getData('kind') as FoodKind;
          // Dropping good food breaks the combo. Dropping rotten food is the correct
          // play and costs nothing.
          if (!kind.isHazard) {
            this.combo = 0;
            this.comboText.setText('');
          }
          food.destroy();
        }
      }

      this.scoreText.setText(String(this.score));
    }

    private endGame() {
      if (this.isOver) return;
      this.isOver = true;

      this.physics.pause();

      callbacks.onGameOver(this.score, {
        itemsCaught: this.itemsCaught,
        maxCombo: this.maxCombo,
        livesLost: 3 - Math.max(0, this.lives),
      });
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WORLD.width,
    height: WORLD.height,
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: CatchScene,
  });

  return {
    destroy: () => game.destroy(true),
    pause: () => game.scene.pause('catch'),
    resume: () => game.scene.resume('catch'),
  };
};
