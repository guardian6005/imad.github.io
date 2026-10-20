(() => {
  const root = document.documentElement;
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);

  /* ---------- page header bits ---------- */
  $('today').textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase();
  $('yr').textContent = new Date().getFullYear();

  /* ---------- day / night with an eraser sweep ---------- */
  const eraser = $('eraser');
  const applyTheme = t => { root.dataset.theme = t; localStorage.setItem('theme', t); };
  $('theme').onclick = () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition || reduce) return applyTheme(next);
    eraser.style.left = '-160px';
    eraser.classList.add('go');
    const vt = document.startViewTransition(() => { applyTheme(next); eraser.style.left = 'calc(100vw + 30px)'; });
    vt.finished.finally(() => eraser.classList.remove('go'));
  };

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---------- pencil sketches ---------- */
  const path = (parent, d, cls, len, delay) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    if (cls) p.setAttribute('class', cls);
    p.style.setProperty('--len', len);
    p.style.setProperty('--d', delay + 's');
    parent.appendChild(p);
    return p;
  };

  // MonteEdge: bootstrap-style equity curves with an upward drift
  const mc = $('mc');
  path(mc, 'M10 4 V122 H296', '', 420, .3);
  path(mc, 'M6 10 L10 4 L14 10 M290 118 L296 122 L290 126', '', 40, 1.2);
  for (let k = 0; k < 14; k++) {
    let y = 104, d = 'M12 ' + y;
    for (let x = 20; x <= 292; x += 8) { y += (Math.random() - .6) * 9; y = Math.max(8, Math.min(120, y)); d += ` L${x} ${y.toFixed(1)}`; }
    path(mc, d, 'walk' + (k === 13 ? ' hero' : ''), 600, .6 + k * .08);
  }

  // M3: a noisy, decaying loss curve that stops at "now"
  const loss = $('loss');
  path(loss, 'M8 4 V88 H296', '', 400, .3);
  let d = 'M10 12';
  for (let x = 14; x <= 236; x += 4) {
    const t = (x - 10) / 55, y = 12 + 66 * (1 - Math.exp(-t)) + (Math.random() - .5) * 9 * Math.exp(-t / 2);
    d += ` L${x} ${Math.min(84, y).toFixed(1)}`;
  }
  path(loss, d, 'curve', 900, .6);

  /* ---------- Black-Scholes bench ---------- */
  const erf = x => {
    const s = Math.sign(x); x = Math.abs(x);
    const t = 1 / (1 + .3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x);
    return s * y;
  };
  const N = x => .5 * (1 + erf(x / Math.SQRT2));
  const pdf = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);

  function bs(S, K, v, T, r, type) {
    const sq = Math.sqrt(T), d1 = (Math.log(S / K) + (r + v * v / 2) * T) / (v * sq), d2 = d1 - v * sq, disc = Math.exp(-r * T);
    const call = type === 'call';
    return {
      price: call ? S * N(d1) - K * disc * N(d2) : K * disc * N(-d2) - S * N(-d1),
      delta: call ? N(d1) : N(d1) - 1,
      gamma: pdf(d1) / (S * v * sq),
      theta: (-S * pdf(d1) * v / (2 * sq) + (call ? -r * K * disc * N(d2) : r * K * disc * N(-d2))) / 365,
      vega: S * pdf(d1) * sq / 100,
      rho: (call ? K * T * disc * N(d2) : -K * T * disc * N(-d2)) / 100
    };
  }
  window.__bs = bs; // handy for checking numbers in the console

  const ui = { S: $('bsS'), K: $('bsK'), V: $('bsV'), T: $('bsT'), R: $('bsR') };
  const chart = $('bsChart');
  let type = 'call';
  const fmt = (n, p) => n.toLocaleString('en-IN', { minimumFractionDigits: p, maximumFractionDigits: p });
  const setR = (id, val) => { $(id).firstChild.nodeValue = val; };

  function renderBS() {
    const S = +ui.S.value, K = +ui.K.value, v = ui.V.value / 100, days = +ui.T.value, T = days / 365, r = ui.R.value / 100;
    $('oS').textContent = fmt(S, 0); $('oK').textContent = fmt(K, 0);
    $('oV').textContent = ui.V.value + '%'; $('oT').textContent = days + 'd'; $('oR').textContent = ui.R.value + '%';
    const g = bs(S, K, v, T, r, type);
    setR('rP', '₹' + fmt(g.price, 2)); setR('rD', g.delta.toFixed(3)); setR('rG', g.gamma.toFixed(5));
    setR('rTh', fmt(g.theta, 2)); setR('rVe', fmt(g.vega, 2)); setR('rRh', fmt(g.rho, 2));

    // chart
    const W = 380, H = 250, L = 46, R = 12, Tp = 16, B = 38;
    const lo = Math.min(S, K) * .93, hi = Math.max(S, K) * 1.07;
    const xs = Array.from({ length: 80 }, (_, i) => lo + (hi - lo) * i / 79);
    const val = xs.map(x => bs(x, K, v, T, r, type).price);
    const pay = xs.map(x => type === 'call' ? Math.max(x - K, 0) : Math.max(K - x, 0));
    const ymax = Math.max(...val, ...pay) * 1.1 || 1;
    const px = x => L + (x - lo) / (hi - lo) * (W - L - R), py = y => H - B - y / ymax * (H - Tp - B);
    const line = ys => xs.map((x, i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${py(ys[i]).toFixed(1)}`).join(' ');
    chart.innerHTML = `
      <path class="axis" d="M${L} ${Tp - 6} V${H - B} H${W - R + 4}"/>
      <path class="axis" d="M${L - 4} ${Tp} L${L} ${Tp - 6} L${L + 4} ${Tp} M${W - R - 2} ${H - B - 4} L${W - R + 4} ${H - B} L${W - R - 2} ${H - B + 4}"/>
      <path class="strike" d="M${px(K).toFixed(1)} ${Tp} V${H - B}"/>
      <path class="payoff" d="${line(pay)}"/>
      <path class="value" d="${line(val)}"/>
      <circle class="dot" cx="${px(S).toFixed(1)}" cy="${py(g.price).toFixed(1)}" r="6"/>
      <text x="${px(K) + 4}" y="${Tp + 12}">K</text>
      <text x="${L}" y="${H - B + 22}">${fmt(lo, 0)}</text>
      <text x="${W - R - 46}" y="${H - B + 22}">${fmt(hi, 0)}</text>
      <text x="${(W + L) / 2 - 22}" y="${H - 6}">spot →</text>
      <text x="6" y="${Tp + 6}">₹</text>
      <text x="${L - 40}" y="${py(ymax / 1.1) + 5}">${fmt(ymax / 1.1, 0)}</text>`;
  }
  Object.values(ui).forEach(i => i.addEventListener('input', renderBS));
  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => {
    type = b.dataset.type;
    document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b));
    renderBS();
  });
  renderBS();

  /* ---------- paper airplane ---------- */
  $('planeBtn').onclick = e => {
    const mail = 'mailto:imaduddin6005@gmail.com?subject=' + encodeURIComponent('Hello from your lab notebook');
    if (reduce) return location.href = mail;
    const src = e.currentTarget.querySelector('svg'), b = src.getBoundingClientRect();
    const fly = src.cloneNode(true);
    fly.classList.add('flying');
    Object.assign(fly.style, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px', margin: 0 });
    document.body.appendChild(fly);
    src.style.visibility = 'hidden';
    const dx = innerWidth - b.left + 60, dy = -b.top - 120;
    fly.animate([
      { transform: 'translate(0,0) rotate(0deg) scale(1)' },
      { transform: `translate(${dx * .25}px,${40}px) rotate(8deg) scale(.95)`, offset: .25 },
      { transform: `translate(${dx * .55}px,${dy * .35}px) rotate(-18deg) scale(.8)`, offset: .6 },
      { transform: `translate(${dx}px,${dy}px) rotate(-28deg) scale(.5)` }
    ], { duration: 1300, easing: 'cubic-bezier(.4,0,.6,1)' }).onfinish = () => {
      fly.remove();
      location.href = mail;
      setTimeout(() => { src.style.visibility = ''; }, 600);
    };
  };

  /* ---------- doodle mode ---------- */
  const cv = $('doodle'), cx = cv.getContext('2d'), btn = $('doodleBtn');
  let strokes = [], cur = null, raf = 0;
  const size = () => { const dpr = devicePixelRatio || 1; cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  const setDoodle = on => { document.body.classList.toggle('doodling', on); btn.setAttribute('aria-pressed', on); };
  btn.onclick = () => setDoodle(!document.body.classList.contains('doodling'));
  $('doodleStop').onclick = () => setDoodle(false);
  addEventListener('keydown', e => { if (e.key === 'Escape') setDoodle(false); });
  cv.addEventListener('pointerdown', e => { cur = { pts: [[e.clientX, e.clientY]], t: Infinity }; strokes.push(cur); loop(); });
  cv.addEventListener('pointermove', e => { if (cur) { cur.pts.push([e.clientX, e.clientY]); loop(); } });
  addEventListener('pointerup', () => { if (cur) { cur.t = performance.now(); cur = null; loop(); } });
  const loop = () => { if (!raf) raf = requestAnimationFrame(frame); };
  function frame(now) {
    raf = 0;
    cx.clearRect(0, 0, innerWidth, innerHeight);
    const col = getComputedStyle(root).getPropertyValue('--accent');
    strokes = strokes.filter(s => now - s.t < 3500);
    strokes.forEach(s => {
      cx.globalAlpha = Math.max(0, Math.min(1, 1 - (now - s.t - 2000) / 1500));
      cx.strokeStyle = col; cx.lineWidth = 2.6; cx.lineCap = cx.lineJoin = 'round';
      cx.beginPath(); s.pts.forEach(([x, y], i) => i ? cx.lineTo(x, y) : cx.moveTo(x, y)); cx.stroke();
    });
    if (strokes.length) loop();
  }
})();
