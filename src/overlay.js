const $ = id => document.getElementById(id);
let collapsed = false;
let autoAnswer = true;
let screenshotDraft = '';
const POSITION_LABELS = { top: '屏幕上方', right: '屏幕右侧', bottom: '屏幕下方', left: '屏幕左侧' };

function applyDisplaySettings() {
  const backgroundTransparency = Number($('backgroundOpacity').value);
  const textTransparency = Number($('textOpacity').value);
  document.documentElement.style.setProperty('--overlay-bg-alpha', ((100 - backgroundTransparency) / 100).toFixed(2));
  document.documentElement.style.setProperty('--overlay-text-alpha', ((100 - textTransparency) / 100).toFixed(2));
  $('backgroundValue').textContent = `${backgroundTransparency}%`;
  $('textValue').textContent = `${textTransparency}%`;
  localStorage.overlayBackgroundTransparency = String(backgroundTransparency);
  localStorage.overlayTextTransparency = String(textTransparency);
}

function loadDisplaySettings() {
  if (localStorage.overlayBackgroundTransparency) $('backgroundOpacity').value = localStorage.overlayBackgroundTransparency;
  if (localStorage.overlayTextTransparency) $('textOpacity').value = localStorage.overlayTextTransparency;
  applyDisplaySettings();
}

function loadPositionSetting() {
  const value = ['top', 'right', 'bottom', 'left'].includes(localStorage.overlayPosition) ? localStorage.overlayPosition : 'top';
  applyPositionSetting(value, false);
}

function applyPositionSetting(value, moveWindow = true) {
  const position = POSITION_LABELS[value] ? value : 'top';
  $('overlayPositionButton').textContent = POSITION_LABELS[position];
  $('overlayPositionButton').setAttribute('aria-expanded', 'false');
  $('overlayPositionMenu').hidden = true;
  document.querySelectorAll('.position-option').forEach(option => {
    const selected = option.dataset.position === position;
    option.classList.toggle('is-selected', selected);
    option.setAttribute('aria-selected', String(selected));
  });
  localStorage.overlayPosition = position;
  if (moveWindow) void window.liveAgent.setOverlayPosition(position);
}

function timeLabel(value) {
  try { return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return ''; }
}

function sourceLabel(source) {
  return source === 'mic' ? '麦克风' : source === 'system' ? '系统声音' : '手动提问';
}

function nearBottom(node) {
  return node.scrollHeight - node.scrollTop - node.clientHeight < 80;
}

function renderTranscriptHistory(items = []) {
  const box = $('transcriptHistory');
  const shouldFollow = nearBottom(box);
  box.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = '等待系统声音或麦克风转写...';
    box.append(empty);
  }
  for (const item of items) {
    const bubble = document.createElement('article');
    bubble.className = `history-bubble ${item.source === 'mic' ? 'mic' : 'system'}`;
    const meta = document.createElement('div'); meta.className = 'bubble-meta';
    const label = document.createElement('span'); label.textContent = sourceLabel(item.source);
    const time = document.createElement('time'); time.textContent = timeLabel(item.createdAt);
    meta.append(label, time);
    const text = document.createElement('p'); text.textContent = item.text;
    bubble.append(meta, text); box.append(bubble);
  }
  if (shouldFollow) box.scrollTop = box.scrollHeight;
  $('transcriptCount').textContent = `${items.length} 条记录`;
}

function renderAnswerHistory(items = [], fallback = null) {
  const box = $('answerHistory');
  const shouldFollow = nearBottom(box);
  box.replaceChildren();
  const rows = items.length ? items : fallback?.question ? [{ question: fallback.question, text: fallback.answer || '等待回答...', status: 'done', sources: fallback.sources || [] }] : [];
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = '每个系统声音问题的回答会独立保留在这里。';
    box.append(empty);
  }
  rows.forEach((item, index) => {
    const bubble = document.createElement('article');
    bubble.className = `answer-bubble ${item.status === 'pending' || item.status === 'streaming' ? 'pending' : ''} ${item.status === 'error' ? 'error' : ''}`;
    const meta = document.createElement('div'); meta.className = 'bubble-meta';
    const label = document.createElement('span'); label.textContent = `回答 ${index + 1}`;
    const state = document.createElement('time'); state.textContent = item.status === 'done' ? timeLabel(item.completedAt || item.createdAt) : item.status === 'error' ? '生成失败' : '生成中';
    meta.append(label, state);
    const question = document.createElement('div'); question.className = 'answer-question'; question.textContent = item.question || '当前问题';
    const text = document.createElement('p'); text.textContent = item.text || '正在结合本次会话、知识库和网络资料分析...';
    bubble.append(meta, question, text);
    if (item.sources?.length) {
      const sources = document.createElement('div'); sources.className = 'sources';
      item.sources.slice(0, 4).forEach(source => {
        const link = document.createElement('a');
        link.href = source.url || '#'; link.textContent = source.title || source.source || '网络来源'; link.title = source.url || '';
        link.onclick = event => { event.preventDefault(); if (source.url) window.liveAgent.openExternal(source.url); };
        sources.append(link);
      });
      bubble.append(sources);
    }
    box.append(bubble);
  });
  if (shouldFollow) box.scrollTop = box.scrollHeight;
  $('answerCount').textContent = `${items.length} 个回答`;
}

window.liveAgent.onOverlayData(data => {
  if (data.status) $('status').textContent = data.status;
  if (Array.isArray(data.liveEntries)) renderTranscriptHistory(data.liveEntries);
  if (Array.isArray(data.liveAnswers)) renderAnswerHistory(data.liveAnswers, data);
  else if (data.question || data.answer) renderAnswerHistory([], data);
  if (typeof data.autoAnswer === 'boolean') {
    autoAnswer = data.autoAnswer;
    updateToggle($('auto'), autoAnswer, `自动回答：${autoAnswer ? '开' : '关'}`);
  }
  if (data.micPending) updateToggle($('microphone'), true, '麦克风：准备中');
  else if (typeof data.micActive === 'boolean') updateToggle($('microphone'), data.micActive, data.micActive ? '麦克风：开' : '麦克风：关');
  if (data.systemAudioPending) updateToggle($('systemAudio'), true, '系统声音：整理中');
  else if (typeof data.systemAudioActive === 'boolean') updateToggle($('systemAudio'), data.systemAudioActive, data.systemAudioActive ? '系统声音：录题中' : '系统声音：开始录题');
});

function updateToggle(button, active, label) {
  button.classList.toggle('is-active', Boolean(active));
  button.setAttribute('aria-pressed', String(Boolean(active)));
  if (label) button.textContent = label;
}

function setScreenshotDraft(data) {
  screenshotDraft = String(data || '');
  const draft = $('screenshotDraft');
  const preview = $('screenshotPreview');
  draft.hidden = !screenshotDraft;
  preview.src = screenshotDraft;
  $('screenshot').textContent = screenshotDraft ? '重新截图' : '截图提问';
  if (screenshotDraft) $('status').textContent = '截图已放入草稿，可删除或发送';
}

function clearScreenshotDraft(notify = true) {
  screenshotDraft = '';
  $('screenshotDraft').hidden = true;
  $('screenshotPreview').removeAttribute('src');
  $('screenshot').textContent = '截图提问';
  if (notify) window.liveAgent.sendOverlayCommand({ type: 'clear-screenshot' });
}

function submitOverlayQuestion() {
  const text = $('overlayInput').value.trim();
  if (!text && !screenshotDraft) return;
  window.liveAgent.sendOverlayCommand({
    type: 'ask',
    text: text || '请根据这张截图识别当前问题并给出合适回答。',
    image: screenshotDraft || null
  });
  $('overlayInput').value = '';
  clearScreenshotDraft(false);
}

$('collapse').onclick = () => { collapsed = !collapsed; document.body.classList.toggle('collapsed', collapsed); updateToggle($('collapse'), collapsed, collapsed ? '展开' : '收起'); };
$('close').onclick = () => window.liveAgent.closeOverlay();
$('quit').onclick = () => window.liveAgent.quitApp();
$('ask').onclick = submitOverlayQuestion;
$('overlayInput').addEventListener('keydown', event => { if (event.key === 'Enter') $('ask').click(); });
$('screenshot').onclick = async () => {
  const button = $('screenshot');
  button.disabled = true;
  try {
    const data = await window.liveAgent.captureScreenImage();
    setScreenshotDraft(data);
    window.liveAgent.sendOverlayCommand({ type: 'screenshot', data });
  } catch (error) {
    $('status').textContent = '截图失败：' + error.message;
  } finally {
    button.disabled = false;
  }
};
$('deleteScreenshot').onclick = () => clearScreenshotDraft();
$('sendScreenshot').onclick = submitOverlayQuestion;
$('systemAudio').onclick = () => window.liveAgent.sendOverlayCommand({ type: 'toggle-system-audio' });
$('microphone').onclick = () => window.liveAgent.sendOverlayCommand({ type: 'toggle-microphone' });
$('clear').onclick = () => window.liveAgent.sendOverlayCommand({ type: 'clear' });
$('auto').onclick = () => { autoAnswer = !autoAnswer; updateToggle($('auto'), autoAnswer, `自动回答：${autoAnswer ? '开' : '关'}`); window.liveAgent.sendOverlayCommand({ type: 'toggle-auto', value: autoAnswer }); };
$('displaySettings').onclick = () => { const panel = $('settingsPanel'); panel.hidden = !panel.hidden; updateToggle($('displaySettings'), !panel.hidden, panel.hidden ? '显示' : '隐藏'); };
$('backgroundOpacity').oninput = applyDisplaySettings;
$('textOpacity').oninput = applyDisplaySettings;
$('overlayPositionButton').onclick = () => {
  const menu = $('overlayPositionMenu');
  const open = menu.hidden;
  menu.hidden = !open;
  $('overlayPositionButton').setAttribute('aria-expanded', String(open));
};
document.querySelectorAll('.position-option').forEach(option => option.onclick = () => applyPositionSetting(option.dataset.position));
document.addEventListener('click', event => {
  if (!event.target.closest('.position-picker')) {
    $('overlayPositionMenu').hidden = true;
    $('overlayPositionButton').setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    $('overlayPositionMenu').hidden = true;
    $('overlayPositionButton').setAttribute('aria-expanded', 'false');
  }
});
loadDisplaySettings();
loadPositionSetting();
