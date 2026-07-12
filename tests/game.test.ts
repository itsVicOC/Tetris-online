import { describe, expect, it } from 'vitest';
import { Game, LOCK_DELAY, cells, clearLines, collides, emptyBoard, rotateKick, scoreFor, seededRandom, shuffleBag } from '../src/game';

describe('game engine', () => {
  it('generates every piece once per bag', () => expect(new Set(shuffleBag(seededRandom(1))).size).toBe(7));
  it('is deterministic for the same seed', () => expect(shuffleBag(seededRandom(42))).toEqual(shuffleBag(seededRandom(42))));
  it('clears complete rows', () => { const board = emptyBoard(); board[19].fill('I'); const result = clearLines(board); expect(result.lines).toBe(1); expect(result.board[0].every(cell => cell === null)).toBe(true); });
  it('uses level-scaled scoring', () => { expect(scoreFor(1, 2)).toBe(200); expect(scoreFor(4, 3)).toBe(2400); });
  it('detects walls and performs a wall kick', () => { const board = emptyBoard(); const piece = { type: 'I' as const, rotation: 0, x: -1, y: 2 }; expect(collides(board, piece)).toBe(true); expect(rotateKick(board, piece, 1)).not.toBeNull(); });
  it('hard drops and locks a piece', () => { const game = new Game(10); const type = game.active.type; expect(game.hardDrop()).toBeGreaterThan(0); expect(game.board.some(row => row.includes(type))).toBe(true); });
  it('keeps seeded queues reproducible', () => { const first = new Game(123); const second = new Game(123); expect(first.active.type).toBe(second.active.type); expect(first.queue).toEqual(second.queue); });
  it('waits for the lock delay before locking a grounded piece', () => { const game = new Game(5); const type = game.active.type; while (game.moveDown()) { /* Move to the floor. */ } expect(game.advanceLock(LOCK_DELAY - 1)).toBe(false); expect(game.board.some(row => row.includes(type))).toBe(false); expect(game.advanceLock(1)).toBe(true); expect(game.board.some(row => row.includes(type))).toBe(true); });
  it('only allows hold once before a piece locks', () => { const game = new Game(8); expect(game.holdPiece()).toBe(true); expect(game.holdPiece()).toBe(false); game.hardDrop(); expect(game.holdPiece()).toBe(true); });
  it('does not score or lock when soft dropping a grounded piece', () => { const game = new Game(9); while (game.moveDown()) { /* Move to the floor. */ } expect(game.softDrop()).toBe(false); expect(game.score).toBe(0); expect(game.board.every(row => row.every(cell => cell === null))).toBe(true); });
  it('keeps O piece cells stable across rotations', () => { const piece = { type: 'O' as const, rotation: 0, x: 3, y: 2 }; expect(cells({ ...piece, rotation: 1 })).toEqual(cells(piece)); });
});
