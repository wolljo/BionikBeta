// 2D ASCII Visualizer – v0.4
// Verbesserungen:
// - AGC (Auto-Gain) auf Basis RMS (lebendigere Amplitude)
// - leichteres Charset auf Phones (kein Dauer-@@@@@)
// - Idle-Glow, wenn wenig Energie / Pause
// - Dual-Audio-Graph (A/B) + Crossfade-Gains + globaler Volume-Gain
(() => {
  const asciiEl = document.getElementById('ascii');

  // Elemente aus Player
  const audioA = document.getElementById('audioA');
  const audioB = document.getElementById('audioB');

  // WebAudio Setup
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const srcA = ctx.createMediaElementSource(audioA);
  const srcB = ctx.createMediaElementSource(audioB);

  const gainA = ctx.createGain();
  const gainB = ctx.createGain();
  gainA.gain.value = 1.0;  // aktiver Kanal wird per Player ausgewählt
  gainB.gain.value = 0.0;

  const mix = ctx.createGain();           // global volume
  mix.gain.value = 0.9;

  const analyser = ctx.createAnalyser();
  const isPhone = Math.min(window.innerWidth, window.innerHeight) < 500;
  analyser.fftSize = isPhone ? 1024 : 2048;

  srcA.connect(gainA);  gainA.connect(mix);
  srcB.connect(gainB);  gainB.connect(mix);
  mix.connect(analyser);
  analyser.connect(ctx.destination);

  const timeData = new Uint8Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  // Charsets
  const light  = " .:-=+*#%@";
  const medium = " .'`^\",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  const chars  = (isPhone ? light : medium).split('');

  // Backbuffer
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
  window.addEventListener('toggle-viz', () => { if (!window.__asciiAlbum?.state?.asciiOn) asciiEl.textContent = ''; });
  resize();

  // AGC
  let rmsAvg = 0.08; // Startschätzung
  const agcFollow = 0.04;

  function rmsFromTime(data) {
    let acc = 0;
    for (let i=0; i<data.length; i++) {
      const v = (data[i]-128)/128;
      acc += v*v;
    }
    return Math.sqrt(acc / data.length);
  }
  function energy(freq) {
    let s=0; for (let i=0; i<freq.length; i++) s += freq[i];
    return s / (freq.length*255); // 0..1
  }

  // FPS Cap
  const targetFPS = isPhone ? 40 : 60;
  const frameInterval = 1000 / targetFPS;
  let last = 0;

  function drawFrame(ts) {
    requestAnimationFrame(drawFrame);
    const state = window.__asciiAlbum?.state || { asciiOn: true };
    if (!state.asciiOn) return;
    if (ts - last < frameInterval) return; last = ts;

    if (ctx.state === 'suspended' && ( !document.getElementById('audioA').paused || !document.getElementById('audioB').paused )) ctx.resume();

    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    const rows = canvas.height, cols = canvas.width;

    // Hintergrund
    g.fillStyle = 'black';
    g.globalAlpha = 1.0;
    g.fillRect(0, 0, cols, rows);

    // AGC
    const rms = rmsFromTime(timeData);
    rmsAvg = (1-agcFollow) * rmsAvg + agcFollow * rms;
    const e = energy(freqData);

    // Ziel-Amplitude (map RMS dynamisch -> 0.22..0.75)
    const dyn = Math.min(1, rms / Math.max(0.02, rmsAvg * 0.9));
    const amp = 0.22 + Math.min(1, dyn) * 0.53;

    const yMid = rows * 0.5;

    // Idle-Glow, wenn Energie sehr niedrig oder beide pausiert
    const bothPaused = document.getElementById('audioA').paused && document.getElementById('audioB').paused;
    if (e < 0.02 || bothPaused) {
      const t = ts * 0.001;
      g.globalAlpha = 0.12;
      for (let x=0; x<cols; x++) {
        const y = yMid + Math.sin((x/cols)*Math.PI*2*2.5 + t) * rows * 0.12;
        g.fillStyle = '#ffffff';
        g.fillRect(x, Math.max(0, Math.min(rows-1, Math.floor(y))), 1, 1);
      }
      g.globalAlpha = 1.0;
    }

    // Hauptspur
    g.globalAlpha = 1.0;
    g.fillStyle = '#ffffff';
    for (let x = 0; x < cols; x++) {
      const tIdx = Math.floor((x / cols) * timeData.length);
      const v = (timeData[tIdx] - 128) / 128;
      const y = yMid + v * (rows * amp * 0.45);
      g.fillRect(x, Math.max(0, Math.min(rows-1, Math.floor(y))), 1, 1);
    }

    // Zweite, weiche Spur
    g.globalAlpha = 0.35;
    for (let x = 0; x < cols; x+=2) {
      const tIdx = Math.floor((x / cols) * timeData.length);
      const v = (timeData[tIdx] - 128) / 128;
      const y = yMid + v * (rows * amp * 0.52);
      g.fillRect(x, Math.max(0, Math.min(rows-1, Math.floor(y+1))), 1, 1);
    }
    g.globalAlpha = 1.0;

    // ASCII Mapping (mit leichtem Gamma)
    const img = g.getImageData(0, 0, cols, rows).data;
    let out = '';
    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const lum = img[i]*0.2126 + img[i+1]*0.7152 + img[i+2]*0.0722;
        const norm = Math.pow(lum / 255, 0.85); // Gamma < 1 -> mehr Differenzierung
        const idx = Math.min(chars.length-1, Math.max(0, Math.floor(norm * (chars.length-1))));
        line += chars[idx];
      }
      out += line + (y < rows-1 ? '\n' : '');
    }
    asciiEl.textContent = out;
  }
  requestAnimationFrame(drawFrame);

  // Expose AudioGraph-Steuerung für Player (Crossfade, Volume, Resume)
  const audioGraph = {
    setVolume(v) { mix.gain.setTargetAtTime(v, ctx.currentTime, 0.02); },
    fadeTo(target, ms=300) {
      return new Promise(resolve => {
        const t = ctx.currentTime;
        const dur = Math.max(0.05, ms/1000);
        if (target === 'A') {
          gainA.gain.cancelScheduledValues(t); gainB.gain.cancelScheduledValues(t);
          gainA.gain.setValueAtTime(gainA.gain.value, t); gainA.gain.linearRampToValueAtTime(1.0, t+dur);
          gainB.gain.setValueAtTime(gainB.gain.value, t); gainB.gain.linearRampToValueAtTime(0.0, t+dur);
        } else {
          gainA.gain.cancelScheduledValues(t); gainB.gain.cancelScheduledValues(t);
          gainA.gain.setValueAtTime(gainA.gain.value, t); gainA.gain.linearRampToValueAtTime(0.0, t+dur);
          gainB.gain.setValueAtTime(gainB.gain.value, t); gainB.gain.linearRampToValueAtTime(1.0, t+dur);
        }
        setTimeout(resolve, ms);
      });
    },
    resume() { if (ctx.state === 'suspended') ctx.resume(); }
  };

  window.__asciiAlbum = Object.assign(window.__asciiAlbum || {}, { audioGraph });

  // iOS/Safari Resume
  const resume = () => { if (ctx.state === 'suspended') ctx.resume(); };
  document.body.addEventListener('touchstart', resume, {passive:true});
  document.body.addEventListener('click', resume, {passive:true});
})();
