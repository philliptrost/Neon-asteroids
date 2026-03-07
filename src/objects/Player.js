export default class Player {
    constructor(scene, x, y, stats = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.rotation = -Math.PI / 2; // point up
        this.vx = 0;
        this.vy = 0;
        this.rotVel = 0;
        this.rotAccel = (stats.rotAccel || 0.009) * 0.8;
        this.maxRotVel = 0.09 * 0.8;
        this.rotFriction = 0.92;  // smoother angular momentum, less instant stop
        this.thrustPower = stats.thrustPower || 0.08;
        this.maxSpeed = stats.maxSpeed || 4.5;
        this.friction = 0.998;    // near-zero drag — objects in space stay in motion
        this._visible = true;
        this._wasThrusting = false;
        this._thrustFlicker = 0;
        this._trail = [];
        this._trailMax = 600;
        this.isThrusting = false;
    }

    rotate(dir) {
        this.rotVel = Phaser.Math.Clamp(
            this.rotVel + this.rotAccel * dir,
            -this.maxRotVel, this.maxRotVel
        );
    }

    applyThrust() {
        this.isThrusting = true;
        this.vx += Math.cos(this.rotation) * this.thrustPower;
        this.vy += Math.sin(this.rotation) * this.thrustPower;
        const spd = Math.hypot(this.vx, this.vy);
        if (spd > this.maxSpeed) { const r = this.maxSpeed / spd; this.vx *= r; this.vy *= r; }
    }

    update(delta, worldW, worldH) {
        // No wrapping — free movement in large world
        this.x += this.vx;
        this.y += this.vy;

        // Soft world barrier — bounce gently off world edges
        const margin = 100;
        if (this.x < margin) { this.vx += 0.15; }
        if (this.x > worldW - margin) { this.vx -= 0.15; }
        if (this.y < margin) { this.vy += 0.15; }
        if (this.y > worldH - margin) { this.vy -= 0.15; }

        this.vx *= this.friction;
        this.vy *= this.friction;
        this.rotation += this.rotVel;
        this.rotVel *= this.rotFriction;

        const spd = Math.hypot(this.vx, this.vy);
        if (spd > 0.25) {
            this._trail.push({
                x: this.x - Math.cos(this.rotation) * 16,
                y: this.y - Math.sin(this.rotation) * 16,
                age: 0,
                spd,
            });
        }
        this._trail = this._trail.filter(p => ++p.age < this._trailMax);

        this._wasThrusting = this.isThrusting;
        this._thrustFlicker = Math.random();
        this.isThrusting = false;
    }

    draw(gfx) {
        // Trail — length and brightness scale with speed; hidden during invincibility blink
        if (this._visible) {
            for (const pt of this._trail) {
                const frac = 1 - pt.age / this._trailMax;
                const spdFrac = Math.min(1, pt.spd / this.maxSpeed);
                const alpha = frac * spdFrac * 0.55;
                const size = Math.min(2.5, 0.6 + spdFrac * 1.8);
                gfx.fillStyle(0xffffff, alpha);
                gfx.fillCircle(pt.x, pt.y, size);
            }
        }
        this.drawAt(gfx, this.x, this.y);
    }

    drawAt(gfx, x, y) {
        if (!this._visible) return;

        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);

        // Ship body
        gfx.lineStyle(2, 0xffffff, 1);
        gfx.fillStyle(0x0a0a2e, 0.95);
        gfx.beginPath();
        gfx.moveTo(x + cos * 18, y + sin * 18);
        gfx.lineTo(x - cos * 10 - sin * 11, y - sin * 10 + cos * 11);
        gfx.lineTo(x - cos * 10 + sin * 11, y - sin * 10 - cos * 11);
        gfx.closePath();
        gfx.fillPath();
        gfx.strokePath();
    }
}
