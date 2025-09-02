(() => {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const audioA = $('#audioA');
  const audioB = $('#audioB');
  // Audio-Elemente gehen durch WebAudio-Graph (visuals.js); deshalb muten:
  audioA.muted = true; audioB.muted = true;

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
    quality: 'auto',   // 'auto' | 'fine' | 'mid' | 'coarse'
    asciiOn: true,
    theme: 'clean',    // 'clean' | 'glitch'
    lastPos: 0,
    active: 'A',       // 'A' | 'B'
    firstPlayDone: false
  };

  try {
    const saved = JSON.parse(localStorage.getItem('ascii_album_state') || '{}');
    Object.assign(state, saved);
  } catch {}

  function save() {
    localStorage.setItem('ascii_album_state', JSON.stringify({
      idx: state.idx, shuffle: state.shuffle, loop: state.loop,
      quality: state.quality, asciiOn: state.asciiOn, theme: state.theme,
      lastPos: getActive().currentTime, vol: vol.value, active: state.active
    }));
  }

  async function loadTracks() {
    const res = await fetch('tracks.json?v=0.4');
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
        <div class="meta"><div class="title">${t.title}</div><div class="artist">${t.artist}</div></div>
        <div class="dur" data-idx="${i}">--:--</div>`;
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
    const cur = getActive().currentTime || 0;
    const dur = isFinite(getActive().duration) ? getActive().duration : 0;
    time.textContent = `${formatTime(cur)} / ${dur ? formatTime(dur) : '00:00'}`;
    seek.value = dur > 0 ? Math.floor((cur / dur) * 1000) : 0;
  }

  function setNowPlaying(t) {
    npTitle.textContent = t.title;
    npArtist.textContent = t.artist;
  }

  function getActive()  { return state.active === 'A' ? audioA : audioB; }
  function getInactive(){ return state.active === 'A' ? audioB : audioA; }

  // UI helpers
  function setQualityCell() {
    const btnQ = document.getElementById('btn-quality');
    const vw = Math.min(window.innerWidth, window.innerHeight);
    if (state.quality === 'auto') {
      const coarse = vw < 420;
      const mid    = vw >= 420 && vw < 900;
      document.documentElement.style.setProperty('--ascii-cell', coarse ? '12px' : (mid ? '10px' : '8px'));
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
    if (state.theme === 'glitch') { document.body.classList.add('glitch');  btnTheme.textContent = 'Theme: Glitch'; }
    else                          { document.body.classList.remove('glitch'); btnTheme.textContent = 'Theme: Clean'; }
  }

  // --- Crossfade Core ---
  let fadeMs = 300;
  async function playIndex(i) {
    if (!state.tracks.length) return;
    const nextIdx = (i + state.tracks.length) % state.tracks.length;
    const track = state.tracks[nextIdx];

    const activeEl = getActive();
    const idleEl   = getInactive();

    idleEl.src = track.srcMp3 + '?v=0.4';
    idleEl.currentTime = 0;

    setNowPlaying(track);
    highlightActive();

    try {
      await idleEl.play();
      // AudioGraph aus visuals steuert Gains:
      if (window.__asciiAlbum?.audioGraph?.fadeTo) {
        await window.__asciiAlbum.audioGraph.fadeTo(state.active === 'A' ? 'B' : 'A', fadeMs);
      }
      // nach Crossfade aktiv umschalten
      activeEl.pause();
      state.active = (state.active === 'A') ? 'B' : 'A';
      btnPlay.textContent = '⏸';
    } catch {
      btnPlay.textContent = '▶';
    }

    state.idx = nextIdx;
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

  // --- Bindings ---
  $('#btn-theme').addEventListener('click', () => { state.theme = (state.theme === 'clean') ? 'glitch' : 'clean'; applyTheme(); save(); });
  $('#btn-quality').addEventListener('click', () => {
    state.quality = (state.quality === 'auto') ? 'fine' : (state.quality === 'fine' ? 'mid' : (state.quality === 'mid' ? 'coarse' : 'auto'));
    setQualityCell(); save();
  });
  $('#btn-viz').addEventListener('click', () => { state.asciiOn = !state.asciiOn; $('#btn-viz').textContent = state.asciiOn ? 'ASCII ON' : 'ASCII OFF'; window.dispatchEvent(new Event('toggle-viz')); save(); });
  $('#btn-viz-toggle')?.addEventListener('click', () => { $('#btn-viz').click(); });

  btnPlay.addEventListener('click', async () => {
    const act = getActive();
    if (act.paused) {
      try { await act.play(); btnPlay.textContent = '⏸'; } catch {}
      if (!state.firstPlayDone && window.__asciiAlbum?.audioGraph?.resume) window.__asciiAlbum.audioGraph.resume();
      state.firstPlayDone = true;
    } else {
      act.pause(); btnPlay.textContent = '▶';
    }
    save();
  });
  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);

  btnShuffle.addEventListener('click', () => {
    state.shuffle = !state.shuffle; btnShuffle.setAttribute('aria-pressed', String(state.shuffle)); save();
  });
  btnLoop.addEventListener('click', () => {
    state.loop = !state.loop; btnLoop.setAttribute('aria-pressed', String(state.loop)); save();
  });

  seek.addEventListener('input', () => {
    const act = getActive();
    const dur = isFinite(act.duration) ? act.duration : 0;
    if (dur > 0) act.currentTime = (seek.value/1000) * dur;
  });

  vol.addEventListener('input', () => {
    const x = parseFloat(vol.value);
    // globale Lautstärke über AudioGraph
    if (window.__asciiAlbum?.audioGraph?.setVolume) window.__asciiAlbum.audioGraph.setVolume(Math.pow(x, 1.5));
    save();
  });

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); btnPlay.click(); }
    if (e.code === 'ArrowRight') next();
    if (e.code === 'ArrowLeft')  prev();
    if (e.key?.toLowerCase() === 's') btnShuffle.click();
    if (e.key?.toLowerCase() === 'l') btnLoop.click();
    if (e.key?.toLowerCase() === 't') $('#btn-theme').click();
    if (e.key?.toLowerCase() === 'q') $('#btn-quality').click();
    if (e.key?.toLowerCase() === 'v') $('#btn-viz').click();
    if (e.key === 'ArrowUp') { vol.value = Math.min(1, parseFloat(vol.value)+0.05); vol.dispatchEvent(new Event('input')); }
    if (e.key === 'ArrowDown') { vol.value = Math.max(0, parseFloat(vol.value)-0.05); vol.dispatchEvent(new Event('input')); }
  });

  // Playlist Drawer (Mobile)
  const btnMenu = $('#btn-menu');
  btnMenu?.addEventListener('click', () => document.body.classList.toggle('playlist-open'));
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
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) { if (dx < 0) next(); else prev(); }
      if (Math.abs(dy) > Math.abs(dx) && dy < -50 && window.innerWidth < 880) document.body.classList.add('playlist-open');
    }, {passive:true});
  })();

  // Audio Events (beide, aber UI nur für aktiven)
  function bindAudioEvents(aud) {
    aud.addEventListener('timeupdate', e => { if (e.target === getActive()) updateTimeUI(); });
    aud.addEventListener('loadedmetadata', e => { if (e.target === getActive()) updateTimeUI(); });
    aud.addEventListener('ended', () => next());
    aud.addEventListener('play',  e => { if (e.target === getActive()) btnPlay.textContent = '⏸'; });
    aud.addEventListener('pause', e => { if (e.target === getActive()) btnPlay.textContent = '▶'; });
  }
  bindAudioEvents(audioA); bindAudioEvents(audioB);

  // Expose für Visualizer + Boot
  window.__asciiAlbum = Object.assign(window.__asciiAlbum || {}, {
    playIndex, next, prev, setQualityCell, getActive, getInactive, state
  });

  // Init
  loadTracks().then(async () => {
    applyTheme(); setQualityCell();

    // Playlist-Peek auf Mobile
    if (window.innerWidth < 880 && !localStorage.getItem('ascii_album_peek')) {
      document.body.classList.add('playlist-peek');
      setTimeout(() => document.body.classList.remove('playlist-peek'), 1200);
      localStorage.setItem('ascii_album_peek', '1');
    }

    // Start Track in aktives Element laden
    const t = state.tracks[(Number.isInteger(state.idx) ? state.idx : 0)] || state.tracks[0];
    if (t) {
      getActive().src = t.srcMp3 + '?v=0.4';
      setNowPlaying(t); highlightActive();
    }
    // Volume über Graph
    if (window.__asciiAlbum?.audioGraph?.setVolume) {
      const v = (typeof state.vol === 'string' || typeof state.vol === 'number') ? state.vol : vol.value;
      window.__asciiAlbum.audioGraph.setVolume(Math.pow(parseFloat(v), 1.5));
    }
    updateTimeUI();
  });

  // Preload Dauer
  function preloadDuration(src, i) {
    const a = new Audio();
    a.src = src; a.preload = 'metadata';
    a.addEventListener('loadedmetadata', () => {
      const el = document.querySelector(`.dur[data-idx="${i}"]`);
      if (el) el.textContent = formatTime(a.duration || 0);
    }, { once: true });
  }
})();
