const OPPONENTS = ['Netburners', 'Slum Snakes', 'The Black Hand', 
	'Tetrads', 'Daedalus', 'Illuminati', '????????????'];

/** @param {NS} ns */
export async function main(ns) {
}

/** @param {NS} ns */
export async function autoGo(ns) {

	// << Game Loop >>
	while (ns.go.getCurrentPlayer() !== 'None') {
		while (ns.go.getCurrentPlayer() == 'White') await ns.go.passTurn();
		//Defend
		//Capture
		//Holes
		//Patterns?
		//Split
		//Expand
		//Attack
		//Random
		if (moveRandom(ns)) continue;
		//Pass if no move
		else ns.go.passTurn();
	}
	// Pick next game
	ns.go.resetBoardState
}

/** 
 * @param {NS} ns
 * @return {string[][]}
 */
function getGrid(ns) {
	const grid = [[]];
	const board = ns.go.getBoardState();
	let x = 0;
	let y = 0;
	for (const line of board) {
		x = 0;
		for (const item of line) {
			grid[x][y].content = item;
			grid[x][y].x = x;
			grid[x][y].y = y;
			x++;
		}
		y++;
	}
	return grid;
}

/** 
 * @param {NS} ns
 * @param {string[][]} grid
 */
function getValidMoves(ns, grid) {
	const holes = ns.go.analysis.getControlledEmptyNodes();
	const gameValidMoves = ns.go.analysis.getValidMoves();
	const validMoves = [];
	for (const line of grid)
		for (const pos of grid)
			if (gameValidMoves[pos.x][pos.y])
				if (holes[pos.x][pos.y] != 'X') //Don't fill my holes
					validMoves.concat(pos);
	return validMoves;
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