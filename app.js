let manifest;
let current = 0;
const audio = new Audio();

async function loadManifest(){
  try{
    const res = await fetch('manifest.json', {cache:'no-store'});
    manifest = await res.json();
  }catch(e){
    console.error('manifest.json not found', e);
    manifest = { tracks: [] };
  }
  renderTracks();
  const params = new URLSearchParams(location.search);
  const deep = params.get('t');
  const idx = manifest.tracks.findIndex(x => x.id === deep);
  loadTrack(idx >= 0 ? idx : 0);
}

function renderTracks(){
  const list = document.getElementById('track-list');
  list.innerHTML = '';
  if(!manifest.tracks.length){
    list.innerHTML = '<div class="track" style="justify-content:center">No tracks yet – add MP3s & update manifest.json</div>';
    return;
  }
  manifest.tracks.forEach((t,i)=>{
    const div = document.createElement('div');
    div.className = 'track';
    div.innerHTML = `
      <img src="${t.cover}" alt="">
      <div class="track-info">
        <div class="track-title">${t.title}</div>
        <div class="track-artist">${t.artist||''}</div>
      </div>
    `;
    div.onclick = () => { loadTrack(i); playTrack(); };
    list.appendChild(div);
  });
}

function loadTrack(i){
  current = i;
  const t = manifest.tracks[i];
  if(!t) return;

  audio.src = t.src;
  document.getElementById('info').textContent = `${t.title} – ${t.artist||''}`.trim();

  if('mediaSession' in navigator){
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title, artist: t.artist||'',
    });
    navigator.mediaSession.setActionHandler?.('previoustrack', ()=> prev());
    navigator.mediaSession.setActionHandler?.('nexttrack', ()=> next());
    navigator.mediaSession.setActionHandler?.('play', ()=> playTrack());
    navigator.mediaSession.setActionHandler?.('pause', ()=> pauseTrack());
  }
}

function playTrack(){
  audio.play().then(()=> {
    document.getElementById('play').textContent='⏸';
  }).catch(err=>console.warn('Play failed', err));
}
function pauseTrack(){ audio.pause(); document.getElementById('play').textContent='▶'; }
function prev(){ if(current>0){ loadTrack(current-1); playTrack(); } }
function next(){ if(current < manifest.tracks.length-1){ loadTrack(current+1); playTrack(); } }

document.getElementById('play').onclick = ()=> audio.paused ? playTrack() : pauseTrack();
document.getElementById('prev').onclick = prev;
document.getElementById('next').onclick = next;

audio.onended = ()=> (current < manifest.tracks.length-1) ? (loadTrack(current+1), playTrack()) : pauseTrack();

loadManifest();
