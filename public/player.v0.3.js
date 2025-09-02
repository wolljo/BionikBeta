(() => {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const audio = $('#audio');
  const seek  = $('#seek');
  const time  = $('#time');
  const vol   = $('#vol');

  const btnPrev    = $('#btn-prev');
  const btnPlay    = $('#btn-play');
  const btnNext    = $('#btn-next');
  const btnShuffle = $('#btn-shuffle');
  const btnLoop    = $('#btn-loop');

  const npTitle = $('#np-title');
  const npArtist = $('#np-artist');
  const playlistEl = $('#playlist');

  const state = {
    tracks: [],
    idx: 0,
    shuffle: false,
    loop: false,
    quality: 'auto',    // 'auto' | 'fine' | 'mid' | 'coarse'
    asciiOn: true,
    theme: 'clean',     // 'clean' | 'glitch'
    lastPos: 0
  };

  // Load saved state
  try {
    const saved = JSON.parse(localStorage.getItem('ascii_album_state') || '{}');
    Object.assign(state, saved);
  } catch {}

  function save() {
    localStorage.setItem('ascii_album_state', JSON.stringify({
      idx: state.idx, shuffle: state.shuffle, loop: state.loop,
      quality: state.quality, asciiOn: state.asciiOn, theme: state.theme,
      lastPos: audio.currentTime, vol: vol.value
    }));
  }

  async function loadTracks() {
    const res = await fetch('tracks.json?v=0.3');
    state.tracks = await res.json();
    renderPlaylist();
  }

  function renderPlaylist() {
    playlistEl.innerHTML = '';
    state.tracks.forEach((t, i) => {
      const item = document.createElement('div');
      item.className = 'track' + (i === state.idx ? ' active' : '');
      item.dataset.idx = i;
      item.innerHTML = `
        <div class="idx">${String(i+1).padStart(2,'0')}</div>
        <div class="meta">
          <div class="title">${t.title}</div>
          <div class="artist">${t.artist}</div>
        </div>
        <div class="dur" data-idx="${i}">--:--</div>
      `;
      item.addEventListener('click', () => playIndex(i, true));
      playlistEl.appendChild(item);
      preloadDuration(t.srcMp3, i);
    });
    highlightActive();
  }

  function highlightActive() {
    $$('.track').forEach(el => el.classList.remove('active'));
    const active = document.querySelector(`.track[data-idx="${state.idx}"]`);
    if (active) active.classList.add('active');
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function updateTimeUI() {
    const cur = audio.currentTime || 0;
    const dur = isFinite(audio.duration) ? audio.duration : 0;
    time.textContent = `${formatTime(cur)} / ${dur ? formatTime(dur) : '00:00'}`;
    if (dur > 0) seek.value = Math.floor((cur / dur) * 1000);
    else seek.value = 0;
  }

  function setNowPlaying(t) {
    npTitle.textContent = t.title;
    npArtist.textContent = t.artist;
  }

  function setQualityCell() {
    const btnQ = document.getElementById('btn-quality');
    const vw = Math.min(window.innerWidth, window.innerHeight);
    // Auto-Logik: Phones → gröbere Zellen, Tablets/Desktops → feiner
    if (state.quality === 'auto') {
      const coarse = vw < 420;     // kleine Phones
      const mid    = vw >= 420 && vw < 900;
      document.documentElement.style.setProperty('--ascii-cell',
        coarse ? '14px' : (mid ? '10px' : '8px'));
      btnQ.textContent = 'Dichte: Auto';
    } else if (state.quality === 'coarse') {
      document.documentElement.style.setProperty('--ascii-cell', '14px');
      btnQ.textContent = 'Dichte: Grob';
    } else if (state.quality === 'fine') {
      document.documentElement.style.setProperty('--ascii-cell', '8px');
      btnQ.textContent = 'Dichte: Fein';
    } else {
      document.documentElement.style.setProperty('--ascii-cell', '10px');
      btnQ.textContent = 'Dichte: Mittel';
    }
    window.dispatchEvent(new Event('resize'));
  }

  function applyTheme() {
    const btnTheme = document.getElementById('btn-theme');
    if (state.theme === 'glitch') {
      document.body.classList.add('glitch');
      btnTheme.textContent = 'Theme: Glitch';
    } else {
      document.body.classList.remove('glitch');
      btnTheme.textContent = 'Theme: Clean';
    }
  }

  function toggleViz() {
    state.asciiOn = !state.asciiOn;
    document.getElementById('btn-viz').textContent = state.asciiOn ? 'ASCII ON' : 'ASCII OFF';
    window.dispatchEvent(new Event('toggle-viz'));
    save();
  }

  async function playIndex(i) {
    if (!state.tracks.length) return;
    state.idx = (i + state.tracks.length) % state.tracks.length;
    const t = state.tracks[state.idx];
    audio.src = t.srcMp3 + '?v=0.3';
    setNowPlaying(t);
    highlightActive();
    try { await audio.play(); btnPlay.textContent = '⏸'; } catch { btnPlay.textContent = '▶'; }
    save();
  }

  function next() {
    if (state.shuffle) {
      let n = Math.floor(Math.random() * state.tracks.length);
      if (n === state.idx && state.tracks.length > 1) n = (n + 1) % state.tracks.length;
      playIndex(n);
    } else if (state.loop) {
      playIndex(state.idx);
    } else {
      playIndex(state.idx + 1);
    }
  }
  function prev() { playIndex(state.idx - 1); }

  // Bindings
  $('#btn-theme').addEventListener('click', () => { state.theme = (state.theme === 'clean') ? 'glitch' : 'clean'; applyTheme(); save(); });
  $('#btn-quality').addEventListener('click', () => {
    state.quality = (state.quality === 'auto') ? 'fine' : (state.quality === 'fine' ? 'mid' : (state.quality === 'mid' ? 'coarse' : 'auto'));
    setQualityCell(); save();
  });
  $('#btn-viz').addEventListener('click', toggleViz);

  btnPlay.addEventListener('click', async () => {
    if (audio.paused) { try { await audio.play(); btnPlay.textContent = '⏸'; } catch {} }
    else { audio.pause(); btnPlay.textContent = '▶'; }
  });
  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);
  btnShuffle.addEventListener('click', () => { state.shuffle = !state.shuffle; btnShuffle.classList.toggle('active', state.shuffle); save(); });
  btnLoop.addEventListener('click', () => { state.loop = !state.loop; btnLoop.textContent = 'Loop: ' + (state.loop ? 'an' : 'aus'); save(); });

  seek.addEventListener('input', () => {
    const dur = isFinite(audio.duration) ? audio.duration : 0;
    if (dur > 0) audio.currentTime = (seek.value/1000) * dur;
  });
  vol.addEventListener('input', () => {
    const x = parseFloat(vol.value);
    audio.volume = Math.pow(x, 1.5);
    save();
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); btnPlay.click(); }
    if (e.code === 'ArrowRight') next();
    if (e.code === 'ArrowLeft')  prev();
    if (e.key?.toLowerCase() === 's') btnShuffle.click();
    if (e.key?.toLowerCase() === 'l') btnLoop.click();
    if (e.key?.toLowerCase() === 't') document.getElementById('btn-theme').click();
    if (e.key?.toLowerCase() === 'q') document.getElementById('btn-quality').click();
    if (e.key?.toLowerCase() === 'v') document.getElementById('btn-viz').click();
    if (e.key === 'ArrowUp') { vol.value = Math.min(1, parseFloat(vol.value)+0.05); vol.dispatchEvent(new Event('input')); }
    if (e.key === 'ArrowDown') { vol.value = Math.max(0, parseFloat(vol.value)-0.05); vol.dispatchEvent(new Event('input')); }
  });

  // Playlist Drawer (Mobile)
  const btnMenu = document.getElementById('btn-menu');
  btnMenu?.addEventListener('click', () => document.body.classList.toggle('playlist-open'));
  // Schließen, wenn Track gewählt
  playlistEl.addEventListener('click', () => { if (window.innerWidth < 880) document.body.classList.remove('playlist-open'); });

  // Wischgesten auf Visualizer
  (() => {
    const area = document.getElementById('ascii');
    let sx = 0, sy = 0, moved = false;
    area.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; moved = false; }, {passive:true});
    area.addEventListener('touchmove',  () => { moved = true; }, {passive:true});
    area.addEventListener('touchend',   (e) => {
      if (!moved) return;
      const dx = (e.changedTouches[0].clientX - sx);
      const dy = (e.changedTouches[0].clientY - sy);
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx < 0) next(); else prev();
      }
    }, {passive:true});
  })();

  // Audio Events
  audio.addEventListener('timeupdate', updateTimeUI);
  audio.addEventListener('loadedmetadata', updateTimeUI);
  audio.addEventListener('ended', next);
  audio.addEventListener('play',  () => { btnPlay.textContent = '⏸'; });
  audio.addEventListener('pause', () => { btnPlay.textContent = '▶'; });

  // Expose für Visualizer
  window.__asciiAlbum = { audio, state, save, playIndex, next, prev, setQualityCell };

  // Init
  loadTracks().then(() => {
    applyTheme();
    setQualityCell();
    const want = Number.isInteger(state.idx) ? state.idx : 0;
    playIndex(want);
    // Lautstärke aus Persistenz
    if (typeof state.vol === 'string' || typeof state.vol === 'number') {
      vol.value = state.vol; vol.dispatchEvent(new Event('input'));
    } else {
      vol.dispatchEvent(new Event('input'));
    }
  });

  // Preload Dauer
  function preloadDuration(src, i) {
    const a = new Audio();
    a.src = src;
    a.preload = 'metadata';
    a.addEventListener('loadedmetadata', () => {
      const el = document.querySelector(`.dur[data-idx="${i}"]`);
      if (el) el.textContent = formatTime(a.duration || 0);
    }, { once: true });
  }
})();
