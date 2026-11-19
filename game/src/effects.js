// Particles, floating text and screen shake.

export class Effects {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.shake = 0;
  }

  addShake(amount) {
    this.shake = Math.min(18, this.shake + amount);
  }

  // World-space shake offset, applied by the renderer.
  shakeOffset() {
    if (this.shake <= 0.2) return { x: 0, y: 0 };
    return {
      x: (Math.random() * 2 - 1) * this.shake,
      y: (Math.random() * 2 - 1) * this.shake,
    };
  }

  burst(x, y, opts = {}) {
    const n = opts.count || 10;
    const color = opts.color || '#ffd76e';
    const speed = opts.speed || 160;
    const life = opts.life || 0.6;
    const size = opts.size || 3;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.7), maxLife: life,
        color, size: size * (0.6 + Math.random() * 0.8),
      });
    }
  }

  dust(x, y) { this.burst(x, y, { count: 5, color: '#c9b896', speed: 60, life: 0.5, size: 4 }); }
  sparks(x, y) { this.burst(x, y, { count: 12, color: '#ffd76e', speed: 260, life: 0.4, size: 2.5 }); }
  muzzle(x, y) { this.burst(x, y, { count: 6, color: '#ffe9a8', speed: 200, life: 0.15, size: 3 }); }
  ring(x, y) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.9, maxLife: 0.9, color: '#7ee787', size: 4, ring: true, ringR: 10 });
  }
  smoke(x, y) { this.burst(x, y, { count: 3, color: '#5a5a5a', speed: 30, life: 1.1, size: 6 }); }

  floatText(x, y, text, color = '#ffffff') {
    this.texts.push({ x, y, text, color, life: 1.2, maxLife: 1.2 });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      if (p.ring) p.ringR += 260 * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - 42 * dt);
  }

  draw(ctx) {
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.ring) {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.ringR, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    for (const t of this.texts) {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
