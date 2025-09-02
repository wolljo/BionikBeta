// 2D ASCII Visualizer – v0.3
// Mobile-Optimierungen: adaptive Zellgröße via state.quality 'auto',
// reduzierte FFT auf Phones, einfache FPS-Kappung, Touch-Resume.

(() => {
  const asciiEl = document.getElementById('ascii');
  const { audio, state } = window.__asciiAlbum;

  // Audio Graph
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaElementSource(audio);
  const analyser = ctx.createAnalyser();

  // FFT dynamisch: Phones kleiner
  const isPhone = Math.min(window.innerWidth, window.innerHeight) < 500;
  analyser.fftSize = isPhone ? 1024 : 2048;

  const timeData = new Uint8Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const gainNode = ctx.createGain();
  gainNode.gain.value = 1.0;

  src.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(ctx.destination);

  const charset = " .'`^\",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  const chars = charset.split('');

  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d', { alpha: false, willReadFrequently: true });

  function resize() {
    const cw = asciiEl.clientWidth;
    const ch = asciiEl.clientHeight;
    const cell = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ascii-cell')) || 10;
    const cols = Math.max(20, Math.floor(cw / cell));
    const rows = Math.max(10, Math.floor(ch / cell));
    canvas.width  = cols;
    canvas.height = rows;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('toggle-viz', () => { if (!state.asciiOn) asciiEl.textContent = ''; });
  resize();

  function rmsFromTime(data) {
    let acc = 0;
    for (let i=0; i<data.length; i++) {
      const v = (data[i]-128)/128;
      acc += v*v;
    }
    return Math.sqrt(acc / data.length);
  }

  // Einfache FPS-Kappung (z. B. 45 auf Mobile, 60 auf Desktop)
  const targetFPS = isPhone ? 45 : 60;
  const frameInterval = 1000 / targetFPS;
  let last = 0;

  function drawFrame(ts) {
    requestAnimationFrame(drawFrame);
    if (!state.asciiOn) return;
    if (ts - last < frameInterval) return;
    last = ts;

    if (ctx.state === 'suspended' && !audio.paused) ctx.resume();

    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    const rows = canvas.height;
    const cols = canvas.width;

    // Hintergrund leicht abdunkeln
    g.fillStyle = 'black';
    g.globalAlpha = 1.0;
    g.fillRect(0, 0, cols, rows);

    const rms = rmsFromTime(timeData);
    const amp = Math.min(0.35 + rms * 0.9, 0.95);
    const yMid = rows * 0.5;

    // Hauptspur
    g.globalAlpha = 1.0;
    g.fillStyle = '#ffffff';
    for (let x = 0; x < cols; x++) {
      const tIdx = Math.floor((x / cols) * timeData.length);
      const v = (timeData[tIdx] - 128) / 128;
      const y = yMid + v * (rows * amp * 0.45);
      g.fillRect(x, Math.max(0, Math.min(rows-1, Math.floor(y))), 1, 1);
    }

    // Zweite, zarte Spur als „Glow“
    g.globalAlpha = 0.4;
    for (let x = 0; x < cols; x+=2) {
      const tIdx = Math.floor((x / cols) * timeData.length);
      const v = (timeData[tIdx] - 128) / 128;
      const y = yMid + v * (rows * amp * 0.5);
      g.fillRect(x, Math.max(0, Math.min(rows-1, Math.floor(y+1))), 1, 1);
    }
    g.globalAlpha = 1.0;

    // ASCII Mapping
    const img = g.getImageData(0, 0, cols, rows).data;
    let out = '';
    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const lum = img[i]*0.2126 + img[i+1]*0.7152 + img[i+2]*0.0722;
        const norm = lum / 255;
        const idx = Math.min(chars.length-1, Math.max(0, Math.floor(norm * (chars.length-1))));
        line += chars[idx];
      }
      out += line + (y < rows-1 ? '\n' : '');
    }
    asciiEl.textContent = out;
  }

  requestAnimationFrame(drawFrame);

  // iOS/Safari: Context un-muten bei Interaktion
  const resume = () => { if (ctx.state === 'suspended') ctx.resume(); };
  document.body.addEventListener('touchstart', resume, {passive:true});
  document.body.addEventListener('click', resume, {passive:true});
})();
