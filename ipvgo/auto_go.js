const OPPONENTS = ['Netburners', 'Slum Snakes', 'The Black Hand', 
	'Tetrads', 'Daedalus', 'Illuminati', '????????????'];

const BLACK = 'X';
const WHITE = 'O';
const EMPTY = '.';
const DEAD = '#';
const UNKOWN = '?';

/** @type {Board} */
let board;

/** @param {NS} ns */
export async function main(ns) {
}

/** @param {NS} ns */
export async function autoGoMatch(ns) {
	// Initialize board object
	board = new Board(ns)
	// << Game Loop >>
	while (ns.go.getCurrentPlayer() !== 'None') {
		while (ns.go.getCurrentPlayer() == 'White') await ns.go.passTurn();
		// Update board info
		board.updateAll()
		// Patterns?
		// Defend
		// Wall off
		// Expand
		// Capture
		// Attack
		// Random
		if (moveRandom(ns)) continue;
		// Pass if no move
		else ns.go.passTurn();
	}
}

class Board {
	/** @param {NS} ns */
	constructor(ns) {
		this.ns = ns
		this.opponent = ns.go.getOpponent()
		this.updateAll()
	}

	updateAll() {
		this.updateBoardState()
		this.updateNodeCount()
		this.updateValidMoves()
		this.updateControlledEmptyNodes()
		this.updateChains()
	}

	updateBoardState() {
		/** @type {{data: string, x: number, y: number}[][]} */
		this.board = this.boardToBoardData(this.ns.go.getBoardState())
		this.boardSize = this.board.length
		// Create a copy of the board surrounded by dead nodes
		const paddedBoard = this.board
		for (let y = 0; y < this.boardSize; y++) {
			paddedBoard[y].unshift({data: DEAD})
			paddedBoard[y].push({data: DEAD})
		}
		const paddingLine = []
		for (let x = this.boardSize + 2; x --> 0;) paddingLine.push({data: DEAD})
		paddedBoard.unshift(paddingLine)
		paddedBoard.push(paddingLine)
		/** @type {{data: string, x: number, y: number}[][]} */
		this.paddedBoard = paddedBoard
		this.paddedBoardSize = this.boardSize + 2
	}

	updateValidMoves() {
		/** @type {{data: boolean, x: number, y: number}[][]} */
		this.validMoves = this.boardToBoardData(this.ns.go.analysis.getValidMoves())
	}

	updateControlledEmptyNodes() {
		/** @type {{data: string, x: number, y: number}[][]} */
		this.controlledEmptyNodes = this.boardToBoardData(this.ns.go.analysis.getControlledEmptyNodes())
	}

	updateChains() {
		/** @type {{chain: number, x: number, y: number, owner: string}[][]} */
		const chains = []
		let chainCounter = 0;

		// Create a full matrix with no chains
		for (let y = 0; y < this.boardSize; y++) {
			for (let x = 0; x < this.boardSize; x++) {
				chains[y][x] = {chain: 0, x: x, y: y, owner: EMPTY}
			}
		}

		let toCheck = []
		for (let y = 0; y < this.boardSize; y++) {
			for (let x = 0; x < this.boardSize; x++) {
				const current = this.board[y][x]
				// Not a piece
				if (current.data === DEAD || current.data === EMPTY) continue
				// Already checked
				if (chains[y][x].owner !== EMPTY) continue
				// A piece not yet checked
				toCheck.push(current)
			}
			while (toCheck.length > 0) {
				const position = toCheck.shift()
				const x = position.x
				const y = position.y
				const data = position.data
				let chain = 0;

				// Check if any of the surrounding pieces was already recorded as part of a chain from the same player
				// Above
				if (data === chains[y-1][x]?.owner)
					chain = chains[y-1][x].chain
				// Left
				else if (data === chains[y][x-1]?.owner)
					chain = chains[y][x-1].chain
				// Right
				else if (data === chains[y][x+1]?.owner)
					chain = chains[y][x+1].chain
				// Below
				else if (data === chains[y+1][x]?.owner)
					chain = chains[y+1][x].chain

				// Add surrounding pieces from the same player to toCheck
				// Above
				if (data === this.board[y-1][x]?.data)
					toCheck.push(this.board[y-1][x])
				// Left
				if (data === this.board[y][x-1]?.data)
					toCheck.push(this.board[y][x-1])
				// Right
				if (data === this.board[y][x+1]?.data)
					toCheck.push(this.board[y][x+1])
				// Below
				if (data === this.board[y+1][x]?.data)
					toCheck.push(this.board[y+1][x])
				
				// Detected an existing chain
				if (chain > 0) 
					chains[y][x] = {chain: chain, x: x, y: y, owner: data}
				// Piece is isolated
				else if (toCheck.length === 0) 
					chains[y][x] = {chain: 0, x: x, y: y, owner: data}
				// Detected a new chain
				else 
					chains[y][x] = {chain: ++chainCounter, x: x, y: y, owner: data}
			}
		}

		// Detected chainCounter chains
		
		/** @type {{chain: number, x: number, y: number, owner: string}[][]} */
		this.chains = chains
	}

	updateNodeCount() {
		let black = 0
		let white = 0
		let dead = 0
		let empty = 0
		for (const row of this.board) {
			for (const node of row) {
				switch(node.data) {
					case BLACK:
						black++
						break
					case WHITE:
						white++
						break
					case DEAD:
						dead++
						break
					case EMPTY:
						empty++
						break
				}
			}
		}
		this.blackNodes = black
		this.whiteNodes = white
		this.deadNodes = dead
		this.emptyNodes = empty
	}

	/**
	 * @param {string[]} board
	 */
	boardToBoardData(board) {
		const boardData = [[]]
		let x = 0
		let y = 0
		for (const line of board) {
			x = 0
			for (const node of line) {
				boardData[y][x] = {
					data: node,
					x: x,
					y: y
				}
				x++
			}
			y++
		}
		return boardData
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @return {boolean}
	 */
	isEye(x, y) {
		return (
			// Must be recognized as controlled empty node to count as an eye
			this.controlledEmptyNodes[x][y].data !== UNKOWN &&
			// Pieces on all 4 sides are an actual chain, not 4 separate pieces
			this.chains[y-1][x].chain > 0 &&
			// Pieces on all 4 sides are from the same chain
			// Note: checking opposite sides first makes sure at least one of the two is not undefined
			this.chains[y-1][x]?.chain === this.chains[y+1][x]?.chain && // Above and below
			this.chains[y][x-1]?.chain === this.chains[y][x+1]?.chain && // Left and right
			this.chains[y-1][x].chain === this.chains[y][x-1].chain // Above and left
		)

		//TODO: Add check for fake eyes (at least 2 opposing corners are part of the chain?)

		//TODO: Add check for 2 immediate sides and two surrounded sides
		// XXXXX
		// X.?.X
		// xxxxx
	}
}

/** 
 * @param {NS} ns 
 * @return {boolean}
 */
async function moveRandom(ns) {
	const grid = getGrid(ns);
	const validMoves = getValidMoves(ns, grid);
	if (validMoves.length === 0) return false;
	let happyWithMove = false;
	let chosenMove = validMoves[0];
	let attempts = 0;
	while (happyWithMove === false) {
		happyWithMove = true;
		chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
		if (attempts < validMoves.length * 10) {
			//Logic to leave alternated holes on the borders
			if (chosenMove.x === 0 || chosenMove.x === grid[0].length - 1)
				happyWithMove = happyWithMove && chosenMove.y % 2 > 0;
			if (chosenMove.y === 0 || chosenMove.y === grid.length - 1)
				happyWithMove = happyWithMove && chosenMove.x % 2 > 0;
		}
		attempts++;
	}
	await ns.go.makeMove(chosenMove.x, chosenMove.y)
	return true;
}

/** 
 * @param {NS} ns 
 * @return {boolean}
 */
function moveDefend(ns) {
	const grid = getGrid(ns);
	const validMoves = getValidMoves(ns, grid);
	if (validMoves.length === 0) return false;
	return false;
}

/** 
 * @param {NS} ns 
 * @return {boolean}
 */
function moveCapture(ns) {
	const grid = getGrid(ns);
	const validMoves = getValidMoves(ns, grid);
	if (validMoves.length === 0) return false;
	return false;
}

/** 
 * @param {NS} ns 
 * @return {boolean}
 */
function moveAttack(ns) {
	const grid = getGrid(ns);
	const validMoves = getValidMoves(ns, grid);
	if (validMoves.length === 0) return false;
	return false;
}

/** 
 * @param {NS} ns 
 * @return {boolean}
 */
function moveExpand(ns) {
	const grid = getGrid(ns);
	const validMoves = getValidMoves(ns, grid);
	if (validMoves.length === 0) return false;
	return false;
}

/** 
 * @param {NS} ns 
 * @return {boolean}
 */
function moveSplit(ns) {
	const grid = getGrid(ns);
	const validMoves = getValidMoves(ns, grid);
	if (validMoves.length === 0) return false;
	//TODO: Include diagonals
	return false;
}