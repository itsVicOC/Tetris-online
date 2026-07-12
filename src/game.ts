export const COLS = 10;
export const ROWS = 20;
export const LOCK_DELAY = 450;
export type Cell = string | null;
export type Board = Cell[][];
export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export type Point = { x: number; y: number };
export type ActivePiece = { type: PieceType; rotation: number; x: number; y: number };
export type GameAction = { at: number; type: 'left' | 'right' | 'rotate' | 'soft' | 'hard' | 'hold' };
export const COLORS: Record<PieceType, string> = { I: '#39d8ff', J: '#5379ff', L: '#ff9a4d', O: '#ffd84d', S: '#56e39f', T: '#b875ff', Z: '#ff5d79' };
const SHAPES: Record<PieceType, Point[]> = {
  I: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
  J: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  L: [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  O: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  S: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  T: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  Z: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
};

export function emptyBoard(): Board { return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null)); }
export function seededRandom(seed: number): () => number { let value = seed >>> 0; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; }; }
export function shuffleBag(random: () => number): PieceType[] { const bag = Object.keys(SHAPES) as PieceType[]; for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } return bag; }
export function cells(piece: ActivePiece): Point[] { let result = SHAPES[piece.type].map(p => ({ ...p })); if (piece.type !== 'O') for (let r = 0; r < piece.rotation % 4; r++) result = result.map(p => ({ x: 3 - p.y, y: p.x })); return result.map(p => ({ x: p.x + piece.x, y: p.y + piece.y })); }
export function collides(board: Board, piece: ActivePiece): boolean { return cells(piece).some(({ x, y }) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])); }
export function merge(board: Board, piece: ActivePiece): Board { const next = board.map(row => [...row]); for (const { x, y } of cells(piece)) if (y >= 0 && y < ROWS) next[y][x] = piece.type; return next; }
export function clearLines(board: Board): { board: Board; lines: number } { const kept = board.filter(row => row.some(cell => !cell)); const lines = ROWS - kept.length; return { board: [...Array.from({ length: lines }, () => Array<Cell>(COLS).fill(null)), ...kept], lines }; }
export function scoreFor(lines: number, level: number): number { return ([0, 100, 300, 500, 800][lines] || 0) * level; }
export function dropInterval(level: number): number { return Math.max(70, 850 - (level - 1) * 65); }
export function rotateKick(board: Board, piece: ActivePiece, direction: 1 | -1): ActivePiece | null { const rotated = { ...piece, rotation: (piece.rotation + direction + 4) % 4 }; for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [0, -2]]) { const candidate = { ...rotated, x: rotated.x + dx, y: rotated.y + dy }; if (!collides(board, candidate)) return candidate; } return null; }

export class Game {
  board = emptyBoard(); score = 0; lines = 0; level = 1; gameOver = false; paused = false; hold: PieceType | null = null; canHold = true; active: ActivePiece; queue: PieceType[] = []; seed: number; startedAt = Date.now(); actions: GameAction[] = [];
  private lockElapsed = 0;
  private lockResets = 0;
  private random: () => number;
  constructor(seed = Math.floor(Math.random() * 0xffffffff)) { this.seed = seed; this.random = seededRandom(seed); this.fillQueue(); this.active = this.spawn(this.queue.shift()!); this.fillQueue(); }
  private fillQueue(): void { while (this.queue.length < 5) this.queue.push(...shuffleBag(this.random)); }
  private spawn(type: PieceType): ActivePiece { return { type, rotation: 0, x: 3, y: 0 }; }
  private resetLockAfterAction(): void {
    if (this.isGrounded() && this.lockResets < 15) { this.lockElapsed = 0; this.lockResets++; }
  }
  private isGrounded(): boolean { return collides(this.board, { ...this.active, y: this.active.y + 1 }); }
  move(dx: number): boolean { const next = { ...this.active, x: this.active.x + dx }; if (collides(this.board, next)) return false; this.active = next; this.resetLockAfterAction(); return true; }
  rotate(direction: 1 | -1 = 1): boolean { const next = rotateKick(this.board, this.active, direction); if (!next) return false; this.active = next; this.resetLockAfterAction(); return true; }
  softDrop(): boolean { if (this.gameOver || this.paused || !this.moveDown()) return false; this.score += 1; return true; }
  hardDrop(): number { if (this.gameOver || this.paused) return 0; let distance = 0; while (this.moveDown()) distance++; this.score += distance * 2; this.lock(); return distance; }
  moveDown(): boolean { const next = { ...this.active, y: this.active.y + 1 }; if (collides(this.board, next)) return false; this.active = next; return true; }
  holdPiece(): boolean { if (!this.canHold || this.gameOver || this.paused) return false; const current = this.active.type; const next = this.hold ?? this.queue.shift()!; this.hold = current; this.active = this.spawn(next); this.fillQueue(); this.canHold = false; this.lockElapsed = 0; this.lockResets = 0; return true; }
  lock(): void { this.board = merge(this.board, this.active); const cleared = clearLines(this.board); this.board = cleared.board; this.lines += cleared.lines; this.score += scoreFor(cleared.lines, this.level); this.level = Math.floor(this.lines / 10) + 1; this.active = this.spawn(this.queue.shift()!); this.fillQueue(); this.canHold = true; this.lockElapsed = 0; this.lockResets = 0; if (collides(this.board, this.active)) this.gameOver = true; }
  tick(): boolean { if (this.gameOver || this.paused || !this.moveDown()) return false; this.lockElapsed = 0; this.lockResets = 0; return true; }
  advanceLock(deltaMs: number): boolean { if (this.gameOver || this.paused) return false; if (!this.isGrounded()) { this.lockElapsed = 0; return false; } this.lockElapsed += deltaMs; if (this.lockElapsed < LOCK_DELAY) return false; this.lock(); return true; }
  get ghost(): ActivePiece { let ghost = { ...this.active }; while (!collides(this.board, { ...ghost, y: ghost.y + 1 })) ghost = { ...ghost, y: ghost.y + 1 }; return ghost; }
  record(action: GameAction['type']): void { if (this.actions.length < 19999) this.actions.push({ at: Date.now() - this.startedAt, type: action }); }
}
