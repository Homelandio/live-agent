const { app, BrowserWindow, ipcMain, safeStorage, session, dialog, shell, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const { buildSkillContext, ensureUserSkillsRoot, listSkillMetadata } = require('./agent-skills');

let win;
let overlay;
let vaultPath;
let liveMode = false;
let vault = { version: 1, files: [], memories: [], conversations: [] };
let transcriberProcess;
let transcriberPort = 0;
let transcriberReady = false;
let transcriberError = '';
let pendingDisplaySourceId = '';

function builtinSkillsRoot() {
  return path.join(__dirname, 'skills');
}

function userSkillsRoot() {
  return ensureUserSkillsRoot(path.join(app.getPath('userData'), 'skills'));
}

async function displaySources() {
  return desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 1, height: 1 },
    fetchWindowIcons: false
  });
}

function configureDisplayCapture() {
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    displaySources().then(sources => {
      const selected = sources.find(source => source.id === pendingDisplaySourceId) || sources[0];
      pendingDisplaySourceId = '';
      if (!selected) return callback({});
      const streams = { video: selected };
      if (process.platform === 'win32' && request.audioRequested) streams.audio = 'loopback';
      callback(streams);
    }).catch(() => callback({}));
  });
}

function requestRaw(url, { method = 'GET', headers = {}, body = null, timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(target, { method, headers: { 'User-Agent': 'LiveAgent/0.1', ...headers } }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 12_000_000) request.destroy(new Error('网络响应过大')); else chunks.push(chunk); });
      response.on('end', () => {
        const responseHeaders = {};
        for (const [key, value] of Object.entries(response.headers)) responseHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value || '');
        resolve({ status: response.statusCode || 0, headers: responseHeaders, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
      request.setTimeout(timeout, () => request.destroy(new Error('请求超时')));
    request.on('error', reject);
    if (body !== null && body !== undefined) request.write(body);
    request.end();
  });
}

async function requestJson(url, timeout = 12000) {
  const response = await requestRaw(url, { timeout });
  if (response.status < 200 || response.status >= 300) throw new Error(`网络检索返回 HTTP ${response.status}`);
  try { return JSON.parse(response.body); } catch { throw new Error('网络检索返回了无法解析的内容'); }
}

function collectRelatedTopics(items, output) {
  for (const item of items || []) {
    if (item.Text && item.FirstURL) output.push({ title: item.Text.split(' - ')[0] || item.Text, snippet: item.Text, url: item.FirstURL, source: 'DuckDuckGo' });
    if (Array.isArray(item.Topics)) collectRelatedTopics(item.Topics, output);
  }
}

function setLiveMode(enabled) {
  liveMode = Boolean(enabled);
  if (win && !win.isDestroyed()) {
    win.setSkipTaskbar(liveMode);
    if (liveMode) win.hide(); else { win.show(); win.focus(); }
  }
  if (overlay && !overlay.isDestroyed()) {
    overlay.setSkipTaskbar(true);
    if (liveMode) { overlay.show(); overlay.focus(); }
  }
  return liveMode;
}
function notifyLiveEnded() { if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) win.webContents.send('overlay-command', { type: 'live-ended' }); }
function focusWindow(target) {
  if (!target || target.isDestroyed()) return false;
  try { if (target.isMinimized()) target.restore(); target.show(); target.focus(); return true; } catch { return false; }
}

function transcriberRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, 'transcriber') : path.join(__dirname, '..', 'transcriber');
}

function startLocalTranscriber() {
  const root = transcriberRoot();
  const script = path.join(root, 'server.py');
  const bundledPython = path.join(root, 'runtime', 'python.exe');
  if (!fs.existsSync(script) || !fs.existsSync(bundledPython)) {
    transcriberError = '本地转录组件尚未安装到软件目录';
    return false;
  }
  try {
    transcriberProcess = spawn(bundledPython, [script, '--model-dir', path.join(root, 'models', 'paraformer-zh-streaming'), '--port', '0'], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    transcriberProcess.stdout.setEncoding('utf8');
    transcriberProcess.stdout.on('data', chunk => {
      for (const line of String(chunk).split(/\r?\n/)) {
        const match = line.match(/^READY\s+(\d+)$/);
        if (match) { transcriberPort = Number(match[1]); transcriberReady = true; transcriberError = ''; }
      }
    });
    transcriberProcess.stderr.setEncoding('utf8');
    transcriberProcess.stderr.on('data', chunk => { transcriberError = String(chunk).trim().split(/\r?\n/).slice(-1)[0] || transcriberError; });
    transcriberProcess.on('error', error => { transcriberReady = false; transcriberError = error.message; });
    transcriberProcess.on('exit', (_code, signal) => { transcriberReady = false; transcriberPort = 0; if (signal !== 'SIGTERM') transcriberError ||= `本地转录进程已退出（${signal || '未知原因'}）`; transcriberProcess = null; });
    return true;
  } catch (error) { transcriberError = error.message; return false; }
}

function stopLocalTranscriber() {
  if (transcriberProcess && !transcriberProcess.killed) transcriberProcess.kill();
  transcriberProcess = null; transcriberPort = 0; transcriberReady = false;
}

function loadVault() {
  vaultPath = path.join(app.getPath('userData'), 'vault.json');
  try { vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8')); } catch { vault = { version: 1, files: [], memories: [], conversations: [] }; }
  vault.version ||= 1;
  vault.files ||= []; vault.memories ||= []; vault.conversations ||= [];
}
function saveVault() {
  fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
  const tempPath = `${vaultPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(vault, null, 2), 'utf8');
  try { fs.renameSync(tempPath, vaultPath); } catch { fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2), 'utf8'); try { fs.unlinkSync(tempPath); } catch {} }
}
function splitText(text, size = 1400, overlap = 160) {
  const chunks = []; for (let i = 0; i < text.length; i += Math.max(1, size - overlap)) chunks.push(text.slice(i, i + size)); return chunks;
}
function searchTerms(text) {
  const source = String(text || '').toLowerCase();
  const raw = source.match(/[a-z0-9][a-z0-9_-]{1,}|[\u4e00-\u9fff]+/g) || [];
  const terms = new Set();
  for (const token of raw) {
    if (/^[\u4e00-\u9fff]+$/.test(token)) {
      if (token.length === 1) terms.add(token);
      for (let i = 0; i < token.length - 1; i++) terms.add(token.slice(i, i + 2));
    } else terms.add(token);
  }
  return [...terms];
}
async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase(); let text = '';
  if (['.txt', '.md', '.json'].includes(ext)) text = fs.readFileSync(filePath, 'utf8');
  else if (ext === '.pdf') { const { PDFParse } = require('pdf-parse'); const p = new PDFParse({ data: fs.readFileSync(filePath) }); text = (await p.getText()).text; await p.destroy(); }
  else if (ext === '.docx') text = (await require('mammoth').extractRawText({ path: filePath })).value;
  return text;
}

function createWindow() {
  if (win && !win.isDestroyed()) return win;
  win = new BrowserWindow({
    width: 1120, height: 760, minWidth: 880, minHeight: 620,
    backgroundColor: '#10151c',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.session.setPermissionRequestHandler((wc, permission, callback) => {
    callback(['media', 'microphone'].includes(permission));
  });
  win.webContents.session.setPermissionCheckHandler((_wc, permission) => ['media', 'microphone'].includes(permission));
  win.on('closed', () => { win = null; });
  return win;
}

function createOverlay() {
  if (overlay && !overlay.isDestroyed()) return overlay;
  overlay = new BrowserWindow({
    width: 520, height: 470, minWidth: 360, minHeight: 240,
    show: false, alwaysOnTop: true, frame: false, resizable: true, transparent: true, skipTaskbar: true,
    backgroundColor: '#00000000', hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  overlay.loadFile(path.join(__dirname, 'overlay.html'));
  overlay.setContentProtection(true);
  overlay.on('closed', () => { overlay = null; if (liveMode) { setLiveMode(false); notifyLiveEnded(); } });
  return overlay;
}

ipcMain.handle('protect-window', (_event, enabled) => {
  if (process.platform === 'win32' && win) {
    // Electron maps this to the Windows display-affinity content-protection API.
    win.setContentProtection(Boolean(enabled));
  }
  return Boolean(enabled);
});
ipcMain.handle('quit-app', () => { app.quit(); return true; });
ipcMain.handle('set-live-mode', (_event, enabled) => setLiveMode(enabled));
ipcMain.handle('env-openai-available', () => Boolean(process.env.OPENAI_API_KEY));
ipcMain.handle('local-transcriber-status', () => ({ available: transcriberReady, port: transcriberPort, error: transcriberError, model: 'FunASR Paraformer 中文流式' }));
ipcMain.handle('display-sources', async () => (await displaySources()).map(source => ({ id: source.id, name: source.name })));
ipcMain.handle('set-display-source', (_event, sourceId) => { pendingDisplaySourceId = String(sourceId || ''); return true; });
ipcMain.handle('local-transcribe', async (_event, payload = {}) => {
  if (!transcriberReady || !transcriberPort) throw new Error(transcriberError || '本地转录服务尚未就绪');
  const body = Buffer.from(String(payload.audioBase64 || ''), 'base64');
  if (!body.length) throw new Error('音频数据为空');
  const result = await requestRaw(`http://127.0.0.1:${transcriberPort}/transcribe`, {
    method: 'POST', headers: { 'Content-Type': payload.mimeType || 'audio/webm', 'Content-Length': body.length }, body, timeout: 60000
  });
  if (result.status < 200 || result.status >= 300) throw new Error(result.body || `本地转录 HTTP ${result.status}`);
  try { return JSON.parse(result.body); } catch { throw new Error('本地转录服务返回了无法解析的内容'); }
});
ipcMain.handle('api-request', async (_event, request = {}) => {
  const target = new URL(String(request.url || ''));
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('API 地址必须使用 HTTP 或 HTTPS');
  const headers = { ...(request.headers || {}) };
  delete headers.origin; delete headers.Origin; delete headers.referer; delete headers.Referer;
  const authorizationName = Object.keys(headers).find(name => name.toLowerCase() === 'authorization');
  if (authorizationName && !String(headers[authorizationName] || '').trim()) delete headers[authorizationName];
  const apiKey = String(request.apiKey || '').trim();
  const environmentKey = request.useEnvironmentKey ? String(process.env.OPENAI_API_KEY || '').trim() : '';
  const selectedKey = request.useEnvironmentKey ? environmentKey : apiKey;
  if (!Object.keys(headers).some(name => name.toLowerCase() === 'authorization') && selectedKey) headers.Authorization = 'Bearer ' + selectedKey;
  let body = request.body ?? null;
  if (request.multipart?.file) {
    const boundary = `----LiveAgentForm${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const parts = [];
    const fields = request.multipart.fields || {};
    for (const [name, value] of Object.entries(fields)) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${String(value)}\r\n`, 'utf8'));
    }
    const file = request.multipart.file;
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.field || 'file'}"; filename="${file.name || 'upload.bin'}"\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`, 'utf8'));
    parts.push(Buffer.from(String(file.base64 || ''), 'base64'));
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
    body = Buffer.concat(parts);
    headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
  }
  return requestRaw(target.toString(), { method: request.method || 'GET', headers, body, timeout: Math.min(Number(request.timeout) || 120000, 180000) });
});
ipcMain.handle('choose-image', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('read-image-data', async (_event, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
});
ipcMain.handle('open-overlay', () => { createOverlay(); focusWindow(overlay); return true; });
ipcMain.handle('close-overlay', () => { if (liveMode) { setLiveMode(false); notifyLiveEnded(); } if (overlay && !overlay.isDestroyed()) overlay.hide(); return true; });
ipcMain.handle('update-overlay', (_event, payload) => { if (overlay && !overlay.isDestroyed()) overlay.webContents.send('overlay-data', payload); return true; });
ipcMain.handle('overlay-command', (_event, command) => { if (win && !win.isDestroyed()) win.webContents.send('overlay-command', command); return true; });
ipcMain.handle('open-external', async (_event, target) => {
  const url = new URL(String(target || ''));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('只允许打开 HTTP 或 HTTPS 链接');
  await shell.openExternal(url.toString());
  return true;
});
ipcMain.handle('web-search', async (_event, query) => {
  const text = String(query || '').trim().slice(0, 240);
  if (!text) return { ok: false, error: '搜索问题为空', results: [] };
  const url = new URL('https://api.duckduckgo.com/');
  url.searchParams.set('q', text); url.searchParams.set('format', 'json'); url.searchParams.set('no_html', '1'); url.searchParams.set('skip_disambig', '1');
  try {
    const data = await requestJson(url.toString());
    const results = [];
    if (data.AbstractText) results.push({ title: data.Heading || text, snippet: data.AbstractText, url: data.AbstractURL || 'https://duckduckgo.com/?q=' + encodeURIComponent(text), source: data.AbstractSource || 'DuckDuckGo' });
    collectRelatedTopics(data.RelatedTopics, results);
    const unique = [...new Map(results.filter(item => item.url).map(item => [item.url, item])).values()].slice(0, 6);
    return { ok: true, query: text, results: unique };
  } catch (error) { return { ok: false, query: text, error: error.message, results: [] }; }
});
ipcMain.handle('choose-files', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Knowledge files', extensions: ['txt', 'md', 'pdf', 'docx', 'json'] }] });
  if (result.canceled) return [];
  return result.filePaths.map(filePath => ({ name: path.basename(filePath), path: filePath, size: fs.statSync(filePath).size }));
});
ipcMain.handle('vault-state', () => ({
  files: vault.files.map(({ text, chunks, ...meta }) => ({ ...meta, chars: text?.length || 0, chunkCount: chunks?.length || 0 })),
  memories: vault.memories,
  conversations: vault.conversations
}));
ipcMain.handle('vault-import', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Knowledge files', extensions: ['txt', 'md', 'pdf', 'docx', 'json'] }] });
  if (result.canceled) return { imported: [], failed: [] };
  const imported = [];
  const failed = [];
  for (const filePath of result.filePaths) {
    try {
      const stat = fs.statSync(filePath); const text = await parseFile(filePath); const id = `${stat.size}-${stat.mtimeMs}-${path.basename(filePath)}`;
      const doc = { id, name: path.basename(filePath), path: filePath, ext: path.extname(filePath), size: stat.size, addedAt: new Date().toISOString(), text, chunks: splitText(text).map((content, index) => ({ id: `${id}:${index}`, index, content })) };
      vault.files = vault.files.filter(x => x.id !== id && x.path !== filePath); vault.files.push(doc); imported.push({ id, name: doc.name, size: doc.size, chunks: doc.chunks.length });
    } catch (error) { failed.push({ name: path.basename(filePath), error: error.message }); }
  }
  if (imported.length) saveVault(); return { imported, failed };
});
ipcMain.handle('vault-delete-file', (_event, id) => { vault.files = vault.files.filter(x => x.id !== id); saveVault(); return true; });
ipcMain.handle('vault-clear', () => { vault.files = []; vault.memories = []; saveVault(); return true; });
ipcMain.handle('vault-export', async () => {
  const result = await dialog.showSaveDialog(win, { defaultPath: `直播智答知识库备份-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'JSON backup', extensions: ['json'] }] });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, JSON.stringify(vault, null, 2), 'utf8');
  return result.filePath;
});
ipcMain.handle('vault-restore', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JSON backup', extensions: ['json'] }] });
  if (result.canceled || !result.filePaths[0]) return null;
  let incoming;
  try { incoming = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8')); } catch { throw new Error('备份文件不是有效的 JSON'); }
  if (!Array.isArray(incoming.files) || !Array.isArray(incoming.memories) || !Array.isArray(incoming.conversations)) throw new Error('备份文件缺少知识库数据');
  const confirm = await dialog.showMessageBox(win, { type: 'warning', buttons: ['取消', '恢复'], defaultId: 0, cancelId: 0, title: '恢复知识库备份', message: '恢复备份会覆盖当前本地知识库、长期记忆和历史对话。', detail: '请确认已经导出当前数据。' });
  if (confirm.response !== 1) return null;
  vault = { version: incoming.version || 1, files: incoming.files, memories: incoming.memories, conversations: incoming.conversations };
  saveVault();
  return { files: vault.files.length, memories: vault.memories.length, conversations: vault.conversations.length };
});
ipcMain.handle('vault-context', (_event, query) => {
  const terms = searchTerms(query); const phrase = String(query || '').trim().toLowerCase(); const rows = [];
  for (const f of vault.files) for (const c of f.chunks || []) {
    const lower = c.content.toLowerCase();
    const termScore = terms.reduce((n, t) => n + (lower.includes(t) ? 1 : 0), 0);
    const phraseScore = phrase && lower.includes(phrase) ? 3 : 0;
    const nameScore = terms.some(t => f.name.toLowerCase().includes(t)) ? 2 : 0;
    rows.push({ source: f.name, fileId: f.id, index: c.index, score: termScore + phraseScore + nameScore, content: c.content });
  }
  const memoryHit = vault.memories.some(memory => terms.some(term => String(memory.text || '').toLowerCase().includes(term)));
  rows.sort((a, b) => b.score - a.score || a.index - b.index); return { memories: vault.memories.slice(-20), chunks: rows.slice(0, 8), hasRelevant: rows.some(row => row.score > 0) || memoryHit };
});
ipcMain.handle('agent-skills', (_event, payload = {}) => {
  const result = buildSkillContext({
    builtinRoot: builtinSkillsRoot(),
    userRoot: userSkillsRoot(),
    query: payload.query,
    mode: payload.mode || 'chat'
  });
  return {
    skills: listSkillMetadata({ builtinRoot: builtinSkillsRoot(), userRoot: userSkillsRoot() }),
    selected: result.selected.map(skill => skill.slug),
    context: result.context
  };
});
ipcMain.handle('open-agent-skills-folder', async () => {
  const folder = userSkillsRoot();
  const error = await shell.openPath(folder);
  if (error) throw new Error(error);
  return folder;
});
ipcMain.handle('vault-save-memory', (_event, memory) => {
  const text = String(memory?.text || '').trim(); if (!text) return false;
  const key = text.replace(/\s+/g, ' ').toLowerCase(); const now = new Date().toISOString();
  const existing = vault.memories.find(x => String(x.text || '').replace(/\s+/g, ' ').toLowerCase() === key);
  if (existing) { existing.category = memory.category || existing.category || 'general'; existing.source = memory.source || existing.source || 'conversation'; existing.updatedAt = now; saveVault(); return existing; }
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text, category: memory.category || 'general', source: memory.source || 'conversation', createdAt: now, updatedAt: now };
  vault.memories.push(item); vault.memories = vault.memories.slice(-500); saveVault(); return item;
});
ipcMain.handle('vault-delete-memory', (_event, id) => { vault.memories = vault.memories.filter(x => x.id !== id); saveVault(); return true; });
ipcMain.handle('vault-save-conversation', (_event, conversation) => {
  if (!conversation?.id || !Array.isArray(conversation.messages)) return false;
  const item = { ...conversation, title: conversation.title || conversation.messages.find(x => x.role === 'user')?.content?.slice(0, 42) || '新对话', updatedAt: new Date().toISOString() };
  const index = vault.conversations.findIndex(x => String(x.id) === String(item.id));
  if (index >= 0) vault.conversations[index] = item; else vault.conversations.push(item);
  vault.conversations = vault.conversations.slice(-50); saveVault(); return true;
});
ipcMain.handle('vault-delete-conversation', (_event, id) => { vault.conversations = vault.conversations.filter(x => String(x.id) !== String(id)); saveVault(); return true; });
ipcMain.handle('read-text-file', async (_event, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (['.txt', '.md', '.json'].includes(ext)) return { name: path.basename(filePath), text: fs.readFileSync(filePath, 'utf8'), supported: true };
  if (ext === '.pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: fs.readFileSync(filePath) });
    const result = await parser.getText();
    await parser.destroy();
    return { name: path.basename(filePath), text: result.text, supported: true };
  }
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return { name: path.basename(filePath), text: result.value, supported: true };
  }
  return { name: path.basename(filePath), text: '', supported: false };
});

ipcMain.handle('secure-store', (_event, value) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable');
  return safeStorage.encryptString(String(value)).toString('base64');
});

ipcMain.handle('secure-unstore', (_event, encoded) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable');
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
});

const hasAppLock = app.requestSingleInstanceLock();
if (!hasAppLock) app.quit();
else {
  app.on('second-instance', () => {
    if (liveMode && focusWindow(overlay)) return;
    if (!focusWindow(win)) createWindow();
  });
  app.whenReady().then(() => { configureDisplayCapture(); loadVault(); userSkillsRoot(); createWindow(); createOverlay(); startLocalTranscriber(); });
  app.on('before-quit', () => stopLocalTranscriber());
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
