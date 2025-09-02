window.addEventListener('error', e => console.error('GlobalError', e.error || e.message));
window.addEventListener('unhandledrejection', e => console.error('PromiseRejection', e.reason));

window.addEventListener('load', () => {
  console.log('ASCII Album v0.3 ready');
  // Nach dem Load einmal Quality-Autologik anstoßen (falls sich Viewport durch UI ändert)
  if (window.__asciiAlbum?.setQualityCell) window.__asciiAlbum.setQualityCell();
});
