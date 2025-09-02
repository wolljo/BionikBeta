window.addEventListener('error', e => console.error('GlobalError', e.error || e.message));
window.addEventListener('unhandledrejection', e => console.error('PromiseRejection', e.reason));

window.addEventListener('load', () => {
  console.log('ASCII Album v0.4 ready');
  // Nach dem Load einmal Quality-Autologik (falls sich UI/Viewport ändert)
  if (window.__asciiAlbum?.setQualityCell) window.__asciiAlbum.setQualityCell();
});


