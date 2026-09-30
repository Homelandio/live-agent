const $ = id => document.getElementById(id);
const labels = { Control: 'Ctrl', CommandOrControl: 'Ctrl/Cmd', Command: 'Cmd', Super: 'Win', Escape: 'Esc', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };

function shortcutDisplay(accelerator) {
  return String(accelerator || '').split('+').map(token => labels[token] || token).join('+');
}

function renderShortcuts(snapshot = {}) {
  const list = $('shortcutList');
  if (!list) return;
  list.replaceChildren();
  const shortcuts = Array.isArray(snapshot.shortcuts) ? snapshot.shortcuts : [];
  if (!shortcuts.length) {
    const empty = document.createElement('div'); empty.className = 'shortcut-empty'; empty.textContent = '快捷键尚未加载'; list.append(empty); return;
  }
  const failed = new Set(snapshot.failed || []);
  for (const item of shortcuts) {
    const row = document.createElement('div'); row.className = 'shortcut-row';
    if (failed.has(item.id)) row.classList.add('failed');
    const label = document.createElement('span'); label.textContent = item.label;
    const key = document.createElement('kbd'); key.textContent = shortcutDisplay(item.accelerator);
    if (failed.has(item.id)) key.title = '该快捷键未注册，可能被其他程序占用';
    row.append(label, key); list.append(row);
  }
  $('shortcutState').textContent = failed.size ? `有 ${failed.size} 项未注册` : '直播中';
}

function applyDisplaySettings(settings = {}) {
  const background = Number(settings.backgroundTransparency);
  const text = Number(settings.textTransparency);
  document.documentElement.style.setProperty('--overlay-bg-alpha', ((100 - (Number.isFinite(background) ? background : 80)) / 100).toFixed(2));
  document.documentElement.style.setProperty('--overlay-text-alpha', ((100 - (Number.isFinite(text) ? text : 40)) / 100).toFixed(2));
}

window.liveAgent.onLiveShortcutsStatus(renderShortcuts);
window.liveAgent.onOverlayDisplaySettings(applyDisplaySettings);

async function init() {
  applyDisplaySettings();
  try { renderShortcuts(await window.liveAgent.getLiveShortcuts()); }
  catch { renderShortcuts(); }
}
void init();
