import { Game, COLORS, COLS, ROWS, cells, dropInterval, type PieceType } from './game';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, Copy, createIcons, Pause, Play, RotateCcw, RotateCw, Square, Trophy, Volume2, VolumeX, X } from 'lucide';
import './styles.css';

type Score = { game_id: string; player_id: string; nickname: string; score: number; level: number; lines: number; created_at: string };
const app = document.querySelector<HTMLDivElement>('#app')!;
function storageGet(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* Storage can be unavailable in restricted browser contexts. */ } }
function storageRemove(key: string): void { try { localStorage.removeItem(key); } catch { /* Ignore unavailable storage. */ } }
const playerId = storageGet('endless-blocks-player') || crypto.randomUUID();
storageSet('endless-blocks-player', playerId);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
let currentGameId = crypto.randomUUID();
let startToken: string | null = null;
let game = new Game();
type GamePhase = 'idle' | 'starting' | 'playing' | 'paused' | 'ended';
let phase: GamePhase = 'idle';
let lastFrame = performance.now();
let accumulator = 0;
let finished = false;
let scoreSubmitted = false;
let audioOn = storageGet('endless-blocks-audio') !== 'off';
function readScores(): Score[] { try { const value: unknown = JSON.parse(storageGet('endless-blocks-scores') || '[]'); return Array.isArray(value) ? value as Score[] : []; } catch { storageRemove('endless-blocks-scores'); return []; } }
let localScores: Score[] = readScores();

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div><span class="kicker">ARCADE / ENDLESS</span><h1>无尽方块</h1></div>
      <div class="top-actions"><button class="icon-button secondary" id="sound" title="切换音效" aria-label="关闭音效"><i data-lucide="volume-2"></i></button><button class="secondary icon-text" id="leaderboard"><i data-lucide="trophy"></i><span>排行榜</span></button></div>
    </header>
    <section class="layout">
      <div class="game-column">
        <div class="hud"><div><span>分数</span><strong id="score">0</strong></div><div><span>等级</span><strong id="level">1</strong></div><div><span>消行</span><strong id="lines">0</strong></div></div>
        <div class="runtime-status" aria-live="polite"><span class="mode local" id="mode-status">本地模式</span><span class="status" id="status">等待开始</span></div>
        <div class="mobile-previews" aria-label="方块预览"><div class="mini-preview"><span>HOLD</span><canvas id="hold-mobile" width="90" height="58"></canvas></div><div class="mini-preview next"><span>NEXT</span><canvas id="next-mobile" width="150" height="58"></canvas></div></div>
        <div class="session-actions inactive"><button class="secondary icon-text" id="pause-game" disabled><i data-lucide="pause"></i><span>暂停</span></button><button class="danger icon-text" id="end-game" disabled><i data-lucide="square"></i><span>结束</span></button></div>
        <div class="game-frame"><canvas id="board" width="300" height="600" aria-label="游戏棋盘"></canvas><div class="game-feedback" id="game-feedback" aria-live="polite"></div><div class="game-overlay" id="game-overlay"><strong id="overlay-title">准备好了吗？</strong><span id="overlay-detail"></span><button class="primary overlay-action icon-text" id="overlay-action"><i data-lucide="play"></i><span>开始游戏</span></button></div></div>
        <div class="controls mobile-controls"><button data-action="hold" title="保留方块"><span>HOLD</span></button><button data-action="left" aria-label="左移" title="左移"><i data-lucide="arrow-left"></i></button><button data-action="rotate-ccw" aria-label="逆时针旋转" title="逆时针旋转"><i data-lucide="rotate-ccw"></i></button><button data-action="rotate" aria-label="顺时针旋转" title="顺时针旋转"><i data-lucide="rotate-cw"></i></button><button data-action="right" aria-label="右移" title="右移"><i data-lucide="arrow-right"></i></button><button data-action="hard" aria-label="硬降" title="硬降"><i data-lucide="arrow-down-to-line"></i></button></div>
      </div>
      <aside class="side"><div class="preview-panel"><span>HOLD</span><canvas id="hold" width="120" height="90"></canvas></div><div class="preview-panel"><span>NEXT</span><canvas id="next" width="120" height="250"></canvas></div><div class="tip" id="control-tip"></div></aside>
    </section>
    <footer><span>玩家 ID <code>${playerId.slice(0, 8)}</code></span><button class="icon-button text-btn" id="copy-player" title="复制完整玩家 ID" aria-label="复制完整玩家 ID"><i data-lucide="copy"></i></button></footer>
    <dialog id="result" aria-labelledby="result-title"><div class="dialog-head"><div><span class="kicker">RUN COMPLETE</span><h2 id="result-title">本局结束</h2></div><button class="close icon-button" id="close-result" aria-label="关闭"><i data-lucide="x"></i></button></div><p class="result-score"><strong id="final-score">0</strong><span>分</span></p><label>玩家昵称<input id="nickname" maxlength="16" minlength="2" autocomplete="nickname" placeholder="输入 2–16 个字符"></label><div class="ids"><div><span>游戏 ID</span><code id="round-id"></code><button class="icon-button text-btn" data-copy="round" title="复制游戏 ID" aria-label="复制游戏 ID"><i data-lucide="copy"></i></button></div><div><span>玩家 ID</span><code id="full-player"></code><button class="icon-button text-btn" data-copy="player" title="复制玩家 ID" aria-label="复制玩家 ID"><i data-lucide="copy"></i></button></div></div><div class="dialog-actions"><button class="secondary" id="restart">再来一局</button><button class="primary" id="submit">提交成绩</button></div><p class="submit-status" id="submit-status" aria-live="polite"></p><div id="result-ranking"></div></dialog>
    <dialog id="rankings" aria-labelledby="rankings-title"><div class="dialog-head"><div><span class="kicker">GLOBAL SCORES</span><h2 id="rankings-title">排行榜</h2></div><button class="close icon-button" id="close-rankings" aria-label="关闭"><i data-lucide="x"></i></button></div><div id="ranking-list"></div></dialog>
    <div class="ui-toast" id="ui-toast" role="status" aria-live="polite"></div>
  </main>`;

const iconSet = { ArrowDownToLine, ArrowLeft, ArrowRight, Check, Copy, Pause, Play, RotateCcw, RotateCw, Square, Trophy, Volume2, VolumeX, X };
function refreshIcons(): void { createIcons({ icons: iconSet }); }
refreshIcons();

const boardCanvas = document.querySelector<HTMLCanvasElement>('#board')!;
const boardCtx = boardCanvas.getContext('2d')!;
const holdCanvas = document.querySelector<HTMLCanvasElement>('#hold')!;
const nextCanvas = document.querySelector<HTMLCanvasElement>('#next')!;
const holdMobileCanvas = document.querySelector<HTMLCanvasElement>('#hold-mobile')!;
const nextMobileCanvas = document.querySelector<HTMLCanvasElement>('#next-mobile')!;
const resultDialog = document.querySelector<HTMLDialogElement>('#result')!;
const rankingsDialog = document.querySelector<HTMLDialogElement>('#rankings')!;
const gameFrame = document.querySelector<HTMLElement>('.game-frame')!;
const gameFeedback = document.querySelector<HTMLElement>('#game-feedback')!;
const uiToast = document.querySelector<HTMLElement>('#ui-toast')!;
const overlay = document.querySelector<HTMLElement>('#game-overlay')!;
const overlayTitle = document.querySelector<HTMLElement>('#overlay-title')!;
const overlayDetail = document.querySelector<HTMLElement>('#overlay-detail')!;
const overlayAction = document.querySelector<HTMLButtonElement>('#overlay-action')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause-game')!;
const endButton = document.querySelector<HTMLButtonElement>('#end-game')!;
const sessionActions = document.querySelector<HTMLElement>('.session-actions')!;
const soundButton = document.querySelector<HTMLButtonElement>('#sound')!;
const leaderboardButton = document.querySelector<HTMLButtonElement>('#leaderboard')!;
const modeStatus = document.querySelector<HTMLElement>('#mode-status')!;
const scoreElement = document.querySelector<HTMLElement>('#score')!;
const levelElement = document.querySelector<HTMLElement>('#level')!;
const linesElement = document.querySelector<HTMLElement>('#lines')!;
const statusElement = document.querySelector<HTMLElement>('#status')!;
const submitButton = document.querySelector<HTMLButtonElement>('#submit')!;
const nicknameInput = document.querySelector<HTMLInputElement>('#nickname')!;
const mobileQuery = window.matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)');

type ConnectionMode = 'local' | 'ready' | 'connecting' | 'online';
function setConnectionMode(mode: ConnectionMode): void {
  modeStatus.className = `mode ${mode}`;
  modeStatus.textContent = ({ local: '本地模式', ready: '全球榜待连接', connecting: '正在连接', online: '全球榜在线' } as Record<ConnectionMode, string>)[mode];
}
setConnectionMode(supabaseUrl && supabaseKey ? 'ready' : 'local');

let toastTimer = 0;
function showToast(message: string): void { window.clearTimeout(toastTimer); uiToast.textContent = message; uiToast.classList.add('visible'); toastTimer = window.setTimeout(() => uiToast.classList.remove('visible'), 1600); }
let feedbackTimer = 0;
function showGameFeedback(message: string, effect: 'line-clear' | 'impact' | 'level-up'): void {
  window.clearTimeout(feedbackTimer); gameFeedback.textContent = message; gameFeedback.className = `game-feedback visible ${effect}`;
  gameFrame.classList.remove(effect); void gameFrame.offsetWidth; gameFrame.classList.add(effect);
  feedbackTimer = window.setTimeout(() => { gameFeedback.className = 'game-feedback'; gameFrame.classList.remove(effect); }, 650);
}

function updateSoundButton(): void {
  soundButton.innerHTML = `<i data-lucide="${audioOn ? 'volume-2' : 'volume-x'}"></i>`;
  soundButton.setAttribute('aria-label', audioOn ? '关闭音效' : '开启音效'); soundButton.setAttribute('aria-pressed', String(audioOn));
  soundButton.title = audioOn ? '关闭音效' : '开启音效'; refreshIcons();
}
function setButtonContent(button: HTMLButtonElement, icon: string, label: string): void { button.innerHTML = `<i data-lucide="${icon}"></i><span>${label}</span>`; refreshIcons(); }

function isMobileAccess(): boolean { return mobileQuery.matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent); }
function updateDeviceGuidance(): void {
  const mobile = isMobileAccess();
  document.body.dataset.device = mobile ? 'mobile' : 'desktop';
  document.querySelector('#control-tip')!.textContent = mobile
    ? '轻触棋盘旋转 · 左右滑动移动 · 下滑降落 · 使用下方触控按钮'
    : '方向键移动 · Z/X 旋转 · 空格硬降 · C 保留 · P 或 Esc 暂停';
  if (phase === 'idle') overlayDetail.textContent = mobile ? '使用触控按钮或在棋盘上滑动操作' : '使用键盘控制方块，P 或 Esc 可暂停';
}

function renderPhase(): void {
  const active = phase === 'playing' || phase === 'paused';
  document.body.dataset.phase = phase;
  pauseButton.disabled = !active; endButton.disabled = !active;
  sessionActions.classList.toggle('inactive', !active);
  setButtonContent(pauseButton, phase === 'paused' ? 'play' : 'pause', phase === 'paused' ? '继续' : '暂停');
  overlay.classList.toggle('hidden', phase === 'playing' || phase === 'ended');
  if (phase === 'idle') { overlayTitle.textContent = '准备好了吗？'; setButtonContent(overlayAction, 'play', '开始游戏'); overlayAction.disabled = false; }
  if (phase === 'starting') { overlayTitle.textContent = '正在准备对局'; overlayDetail.textContent = '请稍候…'; setButtonContent(overlayAction, 'play', '连接中'); overlayAction.disabled = true; }
  if (phase === 'paused') { overlayTitle.textContent = '游戏已暂停'; overlayDetail.textContent = '当前进度已保留'; setButtonContent(overlayAction, 'play', '继续游戏'); overlayAction.disabled = false; }
  statusElement.textContent = ({ idle: '等待开始', starting: '正在准备', playing: '进行中', paused: '已暂停', ended: '本局结束' } as Record<GamePhase, string>)[phase];
  updateDeviceGuidance();
}

function paintBlock(ctx: CanvasRenderingContext2D, type: PieceType, x: number, y: number, size: number, alpha = 1): void {
  if (y < 0) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS[type]; ctx.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
  ctx.fillStyle = 'rgba(255,255,255,.24)'; ctx.fillRect(x * size + 4, y * size + 4, size - 10, 3);
  ctx.globalAlpha = 1;
}

function drawMini(canvas: HTMLCanvasElement, types: (PieceType | null)[]): void {
  const ctx = canvas.getContext('2d')!; ctx.clearRect(0, 0, canvas.width, canvas.height);
  types.forEach((type, index) => { if (!type) return; const piece = { type, rotation: 0, x: 0, y: 0 }; cells(piece).forEach(({ x, y }) => paintBlock(ctx, type, x + 1, y + index * 3, 18)); });
}

function draw(): void {
  const size = boardCanvas.width / COLS;
  boardCtx.fillStyle = '#0d1020'; boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardCtx.strokeStyle = 'rgba(255,255,255,.045)'; boardCtx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) { boardCtx.beginPath(); boardCtx.moveTo(x * size, 0); boardCtx.lineTo(x * size, boardCanvas.height); boardCtx.stroke(); }
  for (let y = 1; y < ROWS; y++) { boardCtx.beginPath(); boardCtx.moveTo(0, y * size); boardCtx.lineTo(boardCanvas.width, y * size); boardCtx.stroke(); }
  if (phase !== 'idle' && phase !== 'starting') {
    game.board.forEach((row, y) => row.forEach((type, x) => type && paintBlock(boardCtx, type as PieceType, x, y, size)));
    if (phase !== 'ended') {
      cells(game.ghost).forEach(({ x, y }) => paintBlock(boardCtx, game.active.type, x, y, size, .18));
      cells(game.active).forEach(({ x, y }) => paintBlock(boardCtx, game.active.type, x, y, size));
    }
  }
}

let lastUiLines = 0;
let lastUiLevel = 1;
function updateUI(): void {
  const score = game.score.toLocaleString(); const level = String(game.level); const lines = String(game.lines);
  if (scoreElement.textContent !== score) scoreElement.textContent = score;
  if (levelElement.textContent !== level) levelElement.textContent = level;
  if (linesElement.textContent !== lines) linesElement.textContent = lines;
  if (phase === 'playing' || phase === 'ended') {
    if (game.level > lastUiLevel) showGameFeedback(`等级 ${game.level}`, 'level-up');
    else if (game.lines > lastUiLines) showGameFeedback(`消除 ${game.lines - lastUiLines} 行`, 'line-clear');
  }
  lastUiLines = game.lines; lastUiLevel = game.level;
  const holdButton = document.querySelector<HTMLButtonElement>('[data-action="hold"]')!;
  holdButton.disabled = phase !== 'playing' || !game.canHold;
  const showPieces = phase !== 'idle' && phase !== 'starting';
  draw(); updatePreviews(showPieces);
}

let previewSignature = '';
function updatePreviews(showPieces: boolean): void {
  const signature = showPieces ? `${game.hold ?? '-'}:${game.queue.slice(0, 5).join('')}` : 'hidden';
  if (signature === previewSignature) return; previewSignature = signature;
  drawMini(holdCanvas, [showPieces ? game.hold : null]); drawMini(nextCanvas, showPieces ? game.queue.slice(0, 5) : []);
  drawMini(holdMobileCanvas, [showPieces ? game.hold : null]); drawMini(nextMobileCanvas, showPieces ? game.queue.slice(0, 2) : []);
}

let audioContext: AudioContext | null = null;
function beep(frequency = 240, duration = .04): void {
  if (!audioOn) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ??= new AudioContextClass(); void audioContext.resume().catch(() => undefined);
  const context = audioContext; const oscillator = context.createOscillator(); const gain = context.createGain();
  oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.035, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
  oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration);
}

function perform(name: string): void {
  if (phase !== 'playing' || game.gameOver || game.paused) return;
  let changed = false;
  if (name === 'left') changed = game.move(-1);
  if (name === 'right') changed = game.move(1);
  if (name === 'rotate') changed = game.rotate();
  if (name === 'rotate-ccw') changed = game.rotate(-1);
  if (name === 'hard') { game.hardDrop(); changed = true; }
  if (name === 'hold') changed = game.holdPiece();
  if (changed) { game.record(name === 'rotate-ccw' ? 'rotate' : name as 'left' | 'right' | 'rotate' | 'hard' | 'hold'); beep(name === 'hard' ? 120 : 260); if (name === 'hard') showGameFeedback('硬降', 'impact'); updateUI(); }
}

function togglePause(): void {
  if (game.gameOver || (phase !== 'playing' && phase !== 'paused')) return;
  phase = phase === 'playing' ? 'paused' : 'playing'; game.paused = phase === 'paused'; if (phase === 'paused') clearHorizontal(); lastFrame = performance.now(); renderPhase();
}
function finish(): void {
  if (finished || (phase !== 'playing' && phase !== 'paused')) return;
  finished = true; phase = 'ended'; game.gameOver = true; game.paused = false; renderPhase(); updateUI(); gameFrame.classList.add('game-over');
  document.querySelector('#final-score')!.textContent = game.score.toLocaleString(); document.querySelector('#round-id')!.textContent = currentGameId; document.querySelector('#full-player')!.textContent = playerId; nicknameInput.value = storageGet('endless-blocks-nickname') || ''; beep(90, .18); resultDialog.showModal(); nicknameInput.focus();
}
async function startGame(): Promise<void> {
  if (phase !== 'idle') return;
  phase = 'starting'; if (supabaseUrl && supabaseKey) setConnectionMode('connecting'); renderPhase();
  currentGameId = crypto.randomUUID(); startToken = null; let seed = Math.floor(Math.random() * 0xffffffff);
  if (supabaseUrl && supabaseKey) {
    try { const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/submit-score`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }, body: JSON.stringify({ action: 'start', game_id: currentGameId, player_id: playerId, seed }) }); if (response.ok) { const session = await response.json() as { token: string; seed: number }; startToken = session.token; seed = session.seed; } }
    catch { startToken = null; }
  }
  setConnectionMode(startToken ? 'online' : 'local');
  game = new Game(seed); finished = false; scoreSubmitted = false; submitButton.disabled = false; accumulator = 0; lastFrame = performance.now(); phase = 'playing'; lastUiLines = 0; lastUiLevel = 1; gameFrame.className = 'game-frame'; document.querySelector('#submit-status')!.textContent = ''; document.querySelector('#result-ranking')!.innerHTML = ''; previewSignature = ''; renderPhase(); updateUI();
}
function returnToIdle(): void {
  game = new Game(0); phase = 'idle'; finished = false; scoreSubmitted = false; submitButton.disabled = false; accumulator = 0; startToken = null; lastUiLines = 0; lastUiLevel = 1; gameFrame.className = 'game-frame'; setConnectionMode(supabaseUrl && supabaseKey ? 'ready' : 'local'); document.querySelector('#submit-status')!.textContent = ''; document.querySelector('#result-ranking')!.innerHTML = ''; previewSignature = ''; renderPhase(); updateUI();
}

function loop(now: number): void {
  const delta = Math.min(now - lastFrame, 100); lastFrame = now;
  if (phase === 'playing' && !game.gameOver) {
    accumulator += delta; let changed = game.advanceLock(delta);
    while (!game.gameOver && accumulator >= dropInterval(game.level)) { const interval = dropInterval(game.level); changed = game.tick() || changed; accumulator -= interval; }
    if (changed) updateUI();
  }
  if (game.gameOver && phase === 'playing') finish(); requestAnimationFrame(loop);
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeout = 3500): Promise<Response> {
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), timeout);
  try { return await fetch(input, { ...init, signal: controller.signal }); } finally { window.clearTimeout(timer); }
}
function bestLocalScores(): Score[] { const best = new Map<string, Score>(); [...localScores].sort((a, b) => b.score - a.score || b.lines - a.lines || a.created_at.localeCompare(b.created_at)).forEach(item => { if (!best.has(item.player_id)) best.set(item.player_id, item); }); return [...best.values()].slice(0, 100); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]!)); }
function renderRanking(items: Score[], target = '#ranking-list'): void { const element = document.querySelector<HTMLElement>(target)!; element.innerHTML = items.length ? `<div class="rank-head"><span>#</span><span>玩家</span><span>分数</span></div>${items.map((item, index) => `<div class="rank-row"><b>${index + 1}</b><span>${escapeHtml(item.nickname)} <small>${item.player_id.slice(0, 8)}</small></span><strong>${item.score.toLocaleString()}</strong></div>`).join('')}` : '<p class="empty">还没有成绩，成为第一位挑战者。</p>'; }
async function loadScores(): Promise<Score[]> { if (!supabaseUrl || !supabaseKey || (!startToken && localScores.length > 0)) return bestLocalScores(); const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/leaderboard?select=game_id,player_id,nickname,score,level,lines,created_at&order=score.desc,lines.desc,created_at.asc&limit=100`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }); if (!response.ok) throw new Error('排行榜暂不可用'); return response.json() as Promise<Score[]>; }

async function submitScore(): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('#nickname')!; const nickname = input.value.trim(); const status = document.querySelector('#submit-status')!;
  if (nickname.length < 2 || nickname.length > 16) { status.textContent = '昵称需要 2–16 个字符。'; return; }
  if (scoreSubmitted) return; storageSet('endless-blocks-nickname', nickname); status.textContent = '正在校验成绩…'; submitButton.disabled = true;
  const payload = { action: 'submit', token: startToken, game_id: currentGameId, player_id: playerId, nickname, score: game.score, level: game.level, lines: game.lines, duration_ms: Date.now() - game.startedAt, seed: game.seed, actions: game.actions };
  try {
    if (supabaseUrl && supabaseKey && startToken) { const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/submit-score`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }, body: JSON.stringify(payload) }, 6000); if (!response.ok) throw new Error('成绩校验失败或已提交'); }
    else { localScores = [{ ...payload, created_at: new Date().toISOString() }, ...localScores].slice(0, 500); storageSet('endless-blocks-scores', JSON.stringify(localScores)); }
    scoreSubmitted = true; status.textContent = supabaseUrl && startToken ? '成绩已进入全球榜。' : '成绩已保存到本机排行榜。';
    try { renderRanking(await loadScores(), '#result-ranking'); } catch { document.querySelector('#result-ranking')!.innerHTML = '<p class="empty">成绩已保存，但排行榜暂时无法刷新。</p>'; }
  } catch (error) { status.textContent = error instanceof DOMException && error.name === 'AbortError' ? '请求超时，请检查网络后重试。' : error instanceof Error ? error.message : '提交失败，请稍后重试。'; }
  finally { submitButton.disabled = scoreSubmitted; }
}

document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => button.addEventListener('click', () => perform(button.dataset.action!)));
async function copyText(button: HTMLButtonElement, value: string): Promise<void> {
  const originalLabel = button.getAttribute('aria-label') || '复制';
  try {
    await navigator.clipboard.writeText(value); button.innerHTML = '<i data-lucide="check"></i>'; button.setAttribute('aria-label', '已复制'); button.classList.add('copied'); refreshIcons(); showToast('已复制到剪贴板');
    window.setTimeout(() => { button.innerHTML = '<i data-lucide="copy"></i>'; button.setAttribute('aria-label', originalLabel); button.classList.remove('copied'); refreshIcons(); }, 1400);
  } catch { showToast('复制失败，请手动选择'); }
}
const pressedHorizontal = new Set<'ArrowLeft' | 'ArrowRight'>();
let activeHorizontal: 'ArrowLeft' | 'ArrowRight' | null = null;
let horizontalDelay: number | null = null;
let horizontalRepeat: number | null = null;
function clearHorizontal(): void { if (horizontalDelay !== null) window.clearTimeout(horizontalDelay); if (horizontalRepeat !== null) window.clearInterval(horizontalRepeat); horizontalDelay = null; horizontalRepeat = null; activeHorizontal = null; }
function startHorizontal(key: 'ArrowLeft' | 'ArrowRight'): void {
  clearHorizontal(); activeHorizontal = key; const action = key === 'ArrowLeft' ? 'left' : 'right'; perform(action);
  horizontalDelay = window.setTimeout(() => { horizontalRepeat = window.setInterval(() => perform(action), 40); }, 150);
}
function isTypingTarget(target: EventTarget | null): boolean { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement; }
document.addEventListener('keydown', event => {
  if (isTypingTarget(event.target) || resultDialog.open || rankingsDialog.open) return;
  if (event.key.toLowerCase() === 'p' || event.key === 'Escape') { togglePause(); return; }
  if (phase !== 'playing') return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { const key = event.key; pressedHorizontal.add(key); if (!event.repeat && activeHorizontal !== key) startHorizontal(key); }
  else if (event.key === 'ArrowDown') { if (game.softDrop()) { game.record('soft'); beep(180); updateUI(); } }
  else if (event.key === ' ') perform('hard'); else if (event.key.toLowerCase() === 'z') { if (game.rotate(-1)) { game.record('rotate'); beep(260); } updateUI(); } else if (event.key.toLowerCase() === 'x') perform('rotate'); else if (event.key.toLowerCase() === 'c') perform('hold');
});
document.addEventListener('keyup', event => { if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return; pressedHorizontal.delete(event.key); if (activeHorizontal === event.key) { clearHorizontal(); const fallback = [...pressedHorizontal].at(-1); if (fallback && phase === 'playing') startHorizontal(fallback); } });
let touchStart: { id: number; x: number; y: number } | null = null;
boardCanvas.addEventListener('pointerdown', event => { if (phase === 'playing' && !touchStart) { touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY }; boardCanvas.setPointerCapture(event.pointerId); } });
boardCanvas.addEventListener('pointerup', event => { if (!touchStart || touchStart.id !== event.pointerId || phase !== 'playing') return; const dx = event.clientX - touchStart.x; const dy = event.clientY - touchStart.y; if (Math.abs(dx) < 18 && Math.abs(dy) < 18) perform('rotate'); else if (Math.abs(dx) > Math.abs(dy)) perform(dx > 0 ? 'right' : 'left'); else if (dy > 80) perform('hard'); else if (dy > 18 && game.softDrop()) { game.record('soft'); updateUI(); } touchStart = null; });
boardCanvas.addEventListener('pointercancel', event => { if (touchStart?.id === event.pointerId) touchStart = null; });
overlayAction.addEventListener('click', () => { if (phase === 'paused') togglePause(); else void startGame(); });
pauseButton.addEventListener('click', togglePause);
endButton.addEventListener('click', finish);
soundButton.addEventListener('click', () => { audioOn = !audioOn; storageSet('endless-blocks-audio', audioOn ? 'on' : 'off'); updateSoundButton(); showToast(audioOn ? '音效已开启' : '音效已关闭'); });
let resumeAfterRankings = false;
leaderboardButton.addEventListener('click', async () => { if (phase === 'playing') { togglePause(); resumeAfterRankings = true; } rankingsDialog.showModal(); document.querySelector('#ranking-list')!.innerHTML = '<p class="empty">加载中…</p>'; try { renderRanking(await loadScores()); } catch { document.querySelector('#ranking-list')!.innerHTML = '<p class="empty">排行榜暂不可用，请检查 Supabase 配置。</p>'; } });
document.querySelector('#submit')!.addEventListener('click', submitScore);
document.querySelector('#restart')!.addEventListener('click', () => { resultDialog.close(); returnToIdle(); void startGame(); });
function closeResult(): void { resultDialog.close(); returnToIdle(); overlayAction.focus(); }
document.querySelector('#close-result')!.addEventListener('click', closeResult);
function closeRankings(): void { rankingsDialog.close(); if (resumeAfterRankings && phase === 'paused') togglePause(); resumeAfterRankings = false; leaderboardButton.focus(); }
document.querySelector('#close-rankings')!.addEventListener('click', closeRankings);
rankingsDialog.addEventListener('cancel', event => { event.preventDefault(); closeRankings(); });
resultDialog.addEventListener('cancel', event => { event.preventDefault(); closeResult(); });
document.querySelector<HTMLButtonElement>('#copy-player')!.addEventListener('click', event => void copyText(event.currentTarget as HTMLButtonElement, playerId));
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(button => button.addEventListener('click', () => void copyText(button, button.dataset.copy === 'round' ? currentGameId : playerId)));
mobileQuery.addEventListener('change', updateDeviceGuidance);
window.addEventListener('resize', updateDeviceGuidance);
document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'playing') togglePause(); });
updateSoundButton(); returnToIdle(); requestAnimationFrame(loop);

declare global { interface Window { webkitAudioContext?: typeof AudioContext } }
