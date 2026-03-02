const COLORS = [0x00ffff, 0xff00ff, 0x00ff88, 0xffff00, 0xff6600, 0x6600ff, 0xff0066, 0x00ccff];

export default class Asteroid {
    constructor(scene, x, y, size, colorHex, speedMult) {
        this.scene = scene;
        this.x = x; this.y = y; this.size = size;
        this.colorHex = colorHex || COLORS[Math.floor(Math.random() * COLORS.length)];
        this.speedMult = speedMult || 1;
        this.speed = (Math.random() * 0.6 + 0.2) * this.speedMult;
        this.angle = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.02;
        this.rotation = 0;
        this.verts = this._makeVerts();
    }

    _makeVerts() {
        const n = Math.floor(Math.random() * 5) + 7;
        return Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2;
            const d = this.size * (0.72 + Math.random() * 0.28);
            return { x: Math.cos(a) * d, y: Math.sin(a) * d };
        });
    }

    // Steered update — no wrapping, soft homing back toward player if too far
    update(playerX, playerY) {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.rotation += this.rotSpeed;

        // If asteroid drifts more than 1400px from player, gently steer it back
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1400) {
            const targetAngle = Math.atan2(dy, dx);
            let diff = targetAngle - this.angle;
            // Normalize angle difference to [-PI, PI]
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.angle += diff * 0.02;
        }
    }

    draw(gfx) { this.drawAt(gfx, this.x, this.y); }

    drawAt(gfx, x, y) {
        const cos = Math.cos(this.rotation), sin = Math.sin(this.rotation);
        gfx.lineStyle(2, this.colorHex, 1);
        gfx.beginPath();
        this.verts.forEach((v, i) => {
            const rx = v.x * cos - v.y * sin + x;
            const ry = v.x * sin + v.y * cos + y;
            i === 0 ? gfx.moveTo(rx, ry) : gfx.lineTo(rx, ry);
        });
        gfx.closePath();
        gfx.strokePath();
    }
}
