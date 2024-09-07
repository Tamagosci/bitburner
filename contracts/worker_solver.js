//Some code copied/inspired by jeek
//https://github.com/jeek/jeek.js/blob/dev/Contracts.js

const SOLUTIONS = {
	'Find Largest Prime Factor': largestPrimeFactor,
	'Subarray with Maximum Sum': subarrayMaximumSum, //Works
	'Total Ways to Sum': waysToSumI, //Works
	'Total Ways to Sum II': waysToSumII,
	'Spiralize Matrix': spiralizeMatrix, //Appears to work
	'Array Jumping Game': arrayJumpingGame,
	'Array Jumping Game II': arrayJumpingGameII,
	'Merge Overlapping Intervals': mergeOverlappingIntervals,
	'Generate IP Addresses': generateIPs, //Works
	'Algorithmic Stock Trader I': stonksI, //All stonks work
	'Algorithmic Stock Trader II': stonksII, //All stonks work
	'Algorithmic Stock Trader III': stonksIII, //All stonks work
	'Algorithmic Stock Trader IV': stonksIV, //All stonks work
	'Minimum Path Sum in a Triangle': triangleMinPathSum,
	'Unique Paths in a Grid I': uniquePathsI, //Appears to work
	'Unique Paths in a Grid II': uniquePathsII, //Appears to work
	'Shortest Path in a Grid': shortestPath,
	'Sanitize Parentheses in Expression': sanitizeParentheses, //Should be fixed
	'Find All Valid Math Expressions': allValidMathExpressions,
	'HammingCodes: Integer to Encoded Binary': hammingEncode, //Appears to work
	'HammingCodes: Encoded Binary to Integer': hammingDecode, //Appears to work
	'Proper 2-Coloring of a Graph': twoColorGraph, //Should be fixed
	'Compression I: RLE Compression': RLEEncode, //Works
	'Compression II: LZ Decompression': LZDecode, //Should be fixed
	'Compression III: LZ Compression': LZEncode, //Copied from source code, fuck it
	'Encryption I: Caesar Cipher': caesarCypher, //Works
	'Encryption II: Vigenère Cipher': vigenereCypher, //Works
	'Null': null, //Known but not implemented
	'Undefined': undefined //Unknown
};
//"ns.codingcontract.createDummyContract('Compression III: LZ Compression');"

const DEFAULT_ERROR = 'ERROR This contracts error should never be seen.';
const UNIMPLEMENTED_ERROR = 'ERROR Solution not yet implemented!';
const UNKOWN_ERROR = 'ERROR Unknown contract type!';
const SOLVER_ERROR = 'ERROR Solver crashed!';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

onmessage = (event) => {
	const contract = event.data;
	let solution = DEFAULT_ERROR;
	if (SOLUTIONS[contract.contractType] === null)
		solution = UNIMPLEMENTED_ERROR;
	else if (SOLUTIONS[contract.contractType] === undefined)
		solution = UNKOWN_ERROR;
	else {
		try { solution = SOLUTIONS[contract.contractType](contract.parameters); }
		catch (e) { solution = SOLVER_ERROR + '\n' + e.message; }
	}
	postMessage({ solution: solution });
};

//--------------------
//    <<SOLVERS>>
//--------------------

/** 
 * @param {number} num 
 * @return {number}
 */
function largestPrimeFactor(num) {
	let largestPrime = -1;
	let current = 2;
	while (current * current <= num) {
		if (num % current === 0) {
			num /= current;
			largestPrime = current;
		} else {
			current++;
		}
	}
	if (num > largestPrime) {
		largestPrime = num;
	}
	return largestPrime;
}

/**
 * @param {number[]} array
 * @return number
 */
function subarrayMaximumSum(array) {
	let maxSum = 0;
	let currentSum = 0;
	for (let i = 0; i < array.length; i++) {
		currentSum += array[i];
		if (currentSum < 0) currentSum = 0;
		else if (currentSum > maxSum) maxSum = currentSum;
	}
	return maxSum;
}

/**
 * @param {number} num
 * @return {number}
 */
function waysToSumI(num) {
	const subProblems = new Array(num + 1).fill(0);
	subProblems[0] = 1;

	for (let i = 1; i < num; i++) {
		for (let o = i; o <= num; o++) {
			subProblems[o] += subProblems[o - i];
		}
	}

	return subProblems[num];
}

/**
 * @param {[number, number[]]} data
 * @return {number}
 */
function waysToSumII(data) {
	//The problem is to find the number of ways to give change for a given amount of money using a given set of coins.
	//The idea is to build a table that stores the number of ways to give change for each amount from 0 to n.
	//No coins is a viable way
	const [changeNeeded, coins] = data;
	const waysToGiveChange = new Array(changeNeeded + 1).fill(0); //change + 1 because otherwise it would end at change - 1
	waysToGiveChange[0] = 1; //Using 0 coins is the only way to give a change of 0

	//For each of the coin types
	for (let currentCoin = 0; currentCoin < coins.length; currentCoin++) {
		//For every value of change >= coin value (up to the required change)
		for (let currentChange = coins[currentCoin]; currentChange <= changeNeeded; currentChange++) {
			//You can reach that change by adding that coin to 'change-coin'
			waysToGiveChange[currentChange] += waysToGiveChange[currentChange - coins[currentCoin]];
		}
	}

	return waysToGiveChange[changeNeeded];
}

/**
 * @param {number[][]} matrix
 * @return {number[]}
 */
function spiralizeMatrix(matrix) {
	let rows = matrix.length;
	let columns = matrix[0].length;
	let result = [];
	while (rows > 0 && columns > 0) {
		//First line
		result = result.concat(matrix.shift());
		rows--;
		if (rows > 0) {
			//Right side
			for (const row of matrix)
				result.push(row.pop());
			columns--;
			if (columns > 0) {
				//Last line
				result = result.concat(matrix.pop().reverse());
				rows--;
				//Left side
				for (let i = rows - 1; i >= 0; i--)
					result.push(matrix[i].shift());
				columns--;
			}
		}
		//Border done, now do the center
	}
	return result;
}

/**
 * @param {number[]} array
 * @retun {boolean}
 */
function arrayJumpingGame(array) {
	return Math.min(arrayJumpingGameII(array), 1);
}

/**
 * @param {number[]} array
 * @retun {number}
 */
function arrayJumpingGameII(array) {
	//The idea is to iterate over the array and keep track of the maximum index we can reach from the current position
	let maximumIndexReached = 0;
	let indexWeCanReachWithOneMoreJump = 0;
	let jumpsRequired = 0;

	//For every position in the array
	for (let currentIndex = 0; currentIndex < array.length; currentIndex++) {
		//If we can already reach the current position
		if (currentIndex <= maximumIndexReached)
			//Add the position jumping range to our maximum reach
			indexWeCanReachWithOneMoreJump = Math.max(indexWeCanReachWithOneMoreJump, currentIndex + array[currentIndex]);
		//Else if we can reach by doing one more jump do it
		else if (currentIndex <= indexWeCanReachWithOneMoreJump) {
			jumpsRequired++;
			maximumIndexReached = indexWeCanReachWithOneMoreJump;
			indexWeCanReachWithOneMoreJump = currentIndex + array[currentIndex];
		}
		//Else we already hit our maximum range
		else return 0;
	}

	return jumpsRequired;
}

/**
 * @param {number[][]} intervals
 * @return {number[][]}
 */
function mergeOverlappingIntervals(intervals) {
	//The idea is to sort the intervals by their start time and then iterate over them and merge overlapping intervals.

	//We start by sorting the intervals by their start time.
	intervals = intervals.sort((a, b) => a[0] - b[0]);

	//Then, we initialize a new list of merged intervals with the first interval.
	let mergedIntervals = [intervals[0]];
	let lastMergedIndex = 0;

	//For each interval in the sorted list
	for (const interval of intervals) {
		//We check if it overlaps with the last interval in the merged list
		if (interval[0] <= mergedIntervals[lastMergedIndex][1])
			//If it does, we merge them by updating the end time to the maximum between its current end time and the end time of the current interval
			mergedIntervals[lastMergedIndex][1] = Math.max(mergedIntervals[lastMergedIndex][1], interval[1])
		else {
			//If it doesn’t, we add the current interval to the merged list
			mergedIntervals.push(interval);
			lastMergedIndex++;
		}
	}

	return mergedIntervals;
}

/**
 * @param {string} sequence
 * @return {string[]}
 */
function generateIPs(sequence) {
	//The idea is to try all possible combinations of digits and checking if they form a valid IP address.
	//We start by initializing an empty list of IP addresses and a list of current segments.
	const validAddresses = [];

	//Loop through all possible combinations of 4 numbers that add up to the length of the string.
	for (let a = 1; a < 4; a++) for (let b = 1; b < 4; b++) for (let c = 1; c < 4; c++) for (let d = 1; d < 4; d++) {
		if (a + b + c + d !== sequence.length) continue;

		const separators = [0, a, a + b, a + b + c, a + b + c + d];
		const segments = [];
		let allSegmentsAreValid = true;
		//Check if each number is valid
		for (let i = 0; i < 4; i++) {
			segments.push(sequence.slice(separators[i], separators[i + 1]));
			if (segments[i] < 0 || segments[i] > 255 || (segments[i].startsWith('0') && segments[i] !== '0')) allSegmentsAreValid = false;
		}
		//If all numbers are valid, concatenate them with dots and add them to the result array
		if (allSegmentsAreValid) {
			const address = segments[0] + '.' + segments[1] + '.' + segments[2] + '.' + segments[3];
			validAddresses.push(address);
		}
	}

	return validAddresses;
}

/**
 * @param {number[]} prices
 * @return {number}
 */
function stonksI(prices) {
	return stonksN(prices, 1);
}

/**
 * @param {number[]} prices
 * @return {number}
 */
function stonksII(prices) {
	return stonksN(prices, prices.length);
}

/**
 * @param {number[]} prices
 * @return {number}
 */
function stonksIII(prices) {
	return stonksN(prices, 2);
}

/**
 * @param {number[]} prices
 * @return {number}
 */
function stonksIV(data) {
	let [maxTransactions, prices] = data;
	return stonksN(prices, maxTransactions);
}

/**
 * @param {number[]} prices
 * @param {number} maxTransactions
 * @return {number}
 */
function stonksN(prices, maxTransactions) {
	//Initialize arrays
	const numberOfRows = maxTransactions + 1;
	const maxMoneyWithXTransactionsUpToDayY = new Array(numberOfRows);
	for (let row = 0; row < numberOfRows; row++) maxMoneyWithXTransactionsUpToDayY[row] = new Array(prices.length).fill(0);

	//Calculate best possible profit for every day for every maxTransaction <= provided
	for (let x = 1; x < numberOfRows; x++) for (let y = 1; y < prices.length; y++) {
		const profitForNotDoingAnything = maxMoneyWithXTransactionsUpToDayY[x][y - 1];
		let profitForSelling = 0;
		for (let day = 0; day < y; day++) profitForSelling = Math.max(profitForSelling, prices[y] - prices[day] + maxMoneyWithXTransactionsUpToDayY[x - 1][day]);
		maxMoneyWithXTransactionsUpToDayY[x][y] = Math.max(profitForSelling, profitForNotDoingAnything);
	}
	return maxMoneyWithXTransactionsUpToDayY[maxTransactions][prices.length - 1];
}

/**
 * @param {[number[]]} triangle
 * @return {number}
 */
function triangleMinPathSum(triangle) {
	const rows = triangle.length;//For each row from the second last up
	for (let row = rows - 2; row >= 0; row--) {
		//For each couple in the row
		for (let col = 0; col <= row; col++) {
			//Add to the current value the smallest of the two after(before)
			triangle[row][col] += Math.min(triangle[row + 1][col], triangle[row + 1][col + 1]);
		}
	}

	return triangle[0][0];
}

/**
 * @param {[number, number]} gridSize
 * @return {number}
 */
function uniquePathsI(gridSize) {
	const [rows, cols] = gridSize;
	const emptyGrid = Array(rows).fill().map(() => Array(cols).fill(0));
	return uniquePathsII(emptyGrid);
}

/**
 * @param {number[][]} grid
 * @return {number}
 */
function uniquePathsII(grid) {
	const [rows, cols] = [grid.length, grid[0].length];
	const pathsToXY = Array(rows).fill().map(() => Array(cols).fill(0));
	pathsToXY[0][0] = 1;

	let left, up;
	for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
		left = (col > 0 && grid[row][col - 1] === 0)
			? pathsToXY[row][col - 1]
			: 0;
		up = (row > 0 && grid[row - 1][col] === 0)
			? pathsToXY[row - 1][col]
			: 0;
		pathsToXY[row][col] += left + up;
	}

	return pathsToXY[rows - 1][cols - 1];
}

/**
 * @param {number[][]} grid
 * @return {string}
 */
function shortestPath(grid) {
	const BAD_TILE = 99;

	const minStepsGrid = Array(grid.length).fill().map(() => Array(grid[0].length).fill(BAD_TILE));
	minStepsGrid[0][0] = 0;

	//Find min steps to reach each coordinate
	const flatGrid = grid.flat();
	//while (minStepsGrid.flat().some((tile, index) => tile === BAD_TILE && flatGrid[index] === 0))
	for (let passes = 0; passes < 10; passes++) for (let x = 0; x < grid.length; x++) for (let y = 0; y < grid[0].length; y++) {
		//Skip obstacles
		if (grid[x][y] === 1) continue;
		//Down
		if (x < grid.length - 1 && grid[x + 1][y] !== 1)
			minStepsGrid[x + 1][y] = Math.min(minStepsGrid[x][y] + 1, minStepsGrid[x + 1][y]);
		//Right
		if (y < grid[0].length - 1 && grid[x][y + 1] !== 1)
			minStepsGrid[x][y + 1] = Math.min(minStepsGrid[x][y] + 1, minStepsGrid[x][y + 1]);
		//Up
		if (x > 0 && grid[x - 1][y] !== 1)
			minStepsGrid[x - 1][y] = Math.min(minStepsGrid[x][y] + 1, minStepsGrid[x - 1][y]);
		//Left
		if (y > 0 && grid[x][y - 1] !== 1)
			minStepsGrid[x][y - 1] = Math.min(minStepsGrid[x][y] + 1, minStepsGrid[x][y - 1]);
	}
	//return minStepsGrid.map(row => row.map(item => item.toString().padStart(2, ' ')).join(' ')).join('\n');

	//End is unreachable
	if (minStepsGrid[grid.length - 1][grid[0].length - 1] === BAD_TILE) return '';

	//Backtrack from endpoint following minSteps
	let path = [];
	let x = grid.length - 1;
	let y = grid[0].length - 1;
	while (minStepsGrid[x][y] > 0) {
		const neighbours = [];
		//Letters are inverted because we care about how to reach current from neighbour, not neighbour from current
		//Up
		if (x > 0) neighbours.push({ x: x - 1, y: y, steps: minStepsGrid[x - 1][y], direction: 'D' });
		//Left
		if (y > 0) neighbours.push({ x: x, y: y - 1, steps: minStepsGrid[x][y - 1], direction: 'R' });
		//Down
		if (x < grid.length - 1) neighbours.push({ x: x + 1, y: y, steps: minStepsGrid[x + 1][y], direction: 'U' });
		//Right
		if (y < grid[0].length - 1) neighbours.push({ x: x, y: y + 1, steps: minStepsGrid[x][y + 1], direction: 'R' });
		//Sort by shortest path
		neighbours.sort((a, b) => a.steps - b.steps);
		//Pick the shortest path
		path.push(neighbours[0].direction);
		x = neighbours[0].x;
		y = neighbours[0].y;
	}

	//Rearrange path in the correct way
	return path.reverse().join('');
}

/**
 * @param {string} sequence
 * @return {string[]}
 */
function sanitizeParentheses(sequence) {
	const sequenceArray = sequence.split('');
	//Remove leading ')'
	while (sequenceArray[0] === ')') sequenceArray.splice(0, 1);
	//Remove trailing '('
	while (sequenceArray[sequenceArray.length - 1] === '(') sequenceArray.splice(sequenceArray.length - 1, 1);
	sequence = sequenceArray.join('');
	//Count brackets function
	/** @param {string | string[]} expression */
	function countWrongBrackets(expression) {
		let currentlyOpen = 0;
		let wronglyClosed = 0;
		for (let i = 0; i < expression.length; i++) {
			if (expression[i] === '(') {
				currentlyOpen++;
			}
			else if (expression[i] === ')') {
				currentlyOpen--;
				if (currentlyOpen < 0) {
					wronglyClosed++;
					currentlyOpen++;
				}
			}
		}
		return [currentlyOpen, wronglyClosed];
	}
	//Count how many extra brackets there are
	const extraBrackets = countWrongBrackets(sequence).reduce((o, c) => o + c);
	//Bruteforce it
	const possibilities = Array(extraBrackets + 1).fill().map(() => Array());
	possibilities[0] = [sequence];
	for (let bracketsRemoved = 1; bracketsRemoved < possibilities.length; bracketsRemoved++) {
		for (const oldSequence of possibilities[bracketsRemoved - 1]) {
			for (let c = 0; c < oldSequence.length; c++) {
				possibilities[bracketsRemoved].push(removeAt(oldSequence, c));
			}
		}
		//Remove duplicates
		possibilities[bracketsRemoved] = removeDuplicates(possibilities[bracketsRemoved]);
	}
	const candidates = possibilities[extraBrackets];
	//Remove invalid
	const valid = candidates.filter(expression => countWrongBrackets(expression).every(x => x === 0));
	return valid;
}

/**
 * @param {[string, number]} data
 * @return {string[]}
 */
function allValidMathExpressions(data) {
	const [digits, result] = data;
	const operations = ['', '+', '-', '*'];
	//example: expressions[3] = ['1+2+34', '1+2+3+4', '1+2+3-4', '1+2+3*4', etc...]
	const expressions = Array(digits.length).fill().map(() => Array());
	expressions[0] = [digits[0]];

	//Populate operations
	for (let i = 1; i < expressions.length; i++)
		for (const expression of expressions[i - 1])
			for (const sym of operations)
				expressions[i].push(expression + sym + digits[i]);

	//Remove options with leading zeroes
	const noLeadingZeroes = [];
	for (const expression of expressions[digits.length - 1]) {
		let hasLeadingZeroes = false;
		for (let c = 2; c < expression.length - 1 && !hasLeadingZeroes; c++)
			if (expression[c] === '0' && operations.includes(expression[c - 1]) && !operations.includes(expression[c + 1]))
				hasLeadingZeroes = true;
		if (!hasLeadingZeroes) noLeadingZeroes.push(expression);
	}

	//Filter only valid results
	const valid = [];
	for (const expression of noLeadingZeroes)
		if (Function(`return ${expression}`)() === result)
			valid.push(expression);

	return valid;
}

/**
 * @param {string} encoded
 * @return {number} value
 */
function hammingDecode(encoded) {
	//Read positions
	const bitIndexes = encoded.split('').map((stringBit, index) => [Number.parseInt(stringBit), index]);
	//Find error
	let currentMod = 2;
	let parityIndex = 1;
	let errorIndex = 0;
	while (currentMod <= bitIndexes.length) {
		//Calculate expected parity
		const expectedParity = bitIndexes
			.slice(parityIndex + 1)
			.filter(([bit, index]) => index % currentMod >= parityIndex)
			.reduce((sum, [bit, index]) => sum + bit, 0) % 2;
		//Update error index
		if (expectedParity !== bitIndexes[parityIndex][0]) errorIndex += parityIndex;
		//Increase counters
		currentMod *= 2;
		parityIndex *= 2;
	}
	//If there is an error fix it
	bitIndexes[errorIndex][0] = (bitIndexes[errorIndex][0] === 1) ? 0 : 1;
	//return bitIndexes.map(([bit, index]) => bit.toString()).join('');
	//Extract data
	const dataBitsString = bitIndexes
		.slice(1)
		.filter(([bit, index]) => !Number.isInteger(Math.log2(index)))
		.map(([bit, index]) => bit.toString())
		.join('');
	return Number.parseInt(dataBitsString, 2);
}

/**
 * @param {number} value
 * @return {string} encoded
 */
function hammingEncode(value) {
	//Convert to binary
	const binaryDataArray = value.toString(2).split('').map(bit => Number.parseInt(bit));

	//Calculate num of parity bits required
	//n parity bits cover (2^n-1)-n data bits
	//n data bits are covered by ~Math.floor(Math.log2(n)+2) parity bits
	let parityBitsRequired = 3;
	while (Math.pow(2, parityBitsRequired - 1) - parityBitsRequired < binaryDataArray.length) parityBitsRequired++;

	//Insert placeholders for parity bits
	//Parity bit n is in position Math.pow(2, n - 1) *when counting from 0
	let encodedArray = [0, 0, 0].concat(...binaryDataArray);
	for (let p = 3; p < parityBitsRequired; p++) encodedArray = insertAt(0, encodedArray, Math.pow(2, p - 1));
	//return encodedArray.map(bit => bit.toString()).join('');

	//Calculate parity bits
	encodedArray = encodedArray.map((bit, index) => [bit, index]);
	let currentMod = 2;
	let parityIndex = 1;
	for (let p = 1; p < parityBitsRequired; p++) {
		//Calculate parity
		const parity = encodedArray
			.slice(parityIndex + 1)
			.filter(([bit, index]) => index % currentMod >= parityIndex)
			.reduce((sum, [bit, index]) => sum + bit, 0) % 2;
		//Update parity in array
		encodedArray[parityIndex] = [parity, parityIndex];
		//Increase counters
		currentMod *= 2;
		parityIndex *= 2;
	}
	//Calculate overall parity bit
	encodedArray[0][0] = encodedArray.slice(1).reduce((sum, [bit, index]) => sum + bit, 0) % 2;
	return encodedArray.map(([bit, index]) => bit.toString()).join('');
}

/**
 * @param {[number, number[]]} graph
 * @return {number[]}
 */
function twoColorGraph(graph) {
	//Interpret data
	const [count, edges] = graph;
	//Setup colors
	const colors = new Array(count).fill(-1);
	//Setup adjacent list
	const adjacentList = new Array(count).fill().map(() => Array());
	for (let i = 0; i < edges.length; i++) {
		let left = edges[i][0];
		let right = edges[i][1];
		adjacentList[left].push(right);
		adjacentList[right].push(left);
	}

	//Color it
	for (let currentVertex = 0; currentVertex < count; currentVertex++) {
		//If the current vertex has not been colored yet
		if (colors[currentVertex] === -1) {
			//Assign color 1 to the current vertex
			colors[currentVertex] = 1;
			//Add the current vertex to the queue
			let queue = [currentVertex];
			//While the queue is not empty
			while (queue.length > 0) {
				//Remove the first vertex from the queue
				let examinedVertex = queue.shift();
				//For each adjacent vertex
				for (let j = 0; j < adjacentList[examinedVertex].length; j++) {
					let adjacentVertex = adjacentList[examinedVertex][j];
					//If the adjacent vertex has not been colored yet
					if (colors[adjacentVertex] === -1) {
						//Assign the opposite color of the current vertex to the adjacent vertex
						colors[adjacentVertex] = 1 - colors[examinedVertex];
						//Add the adjacent vertex to the queue
						queue.push(adjacentVertex);
					} else if (colors[adjacentVertex] === colors[examinedVertex]) {
						//If the adjacent vertex has the same color as the current vertex, return an empty array
						return [];
					}
				}
			}
		}
	}

	return colors;
}

/**
 * @param {string} sequence
 * @return {string}
 */
function RLEEncode(sequence) {
	let compressed = '';
	let lastChar = sequence[0];
	let currentCount = 1;
	for (let i = 1; i < sequence.length; i++) {
		if (currentCount === 9 || sequence[i] !== lastChar) {
			compressed += currentCount.toString() + lastChar;
			lastChar = sequence[i];
			currentCount = 1;
		}
		else {
			currentCount++;
		}
	}
	compressed += currentCount.toString() + lastChar;
	return compressed;
}

/**
 * @param {string} sequence
 * @return {string}
 */
function LZDecode(sequence) {
	let sequenceArray = sequence.split('');
	let final = '';

	let blockLength = 0;
	let currentBlock = [];
	let backtrack = 0;
	let backtrackStartingIndex = 0;
	let isCompressedBlock = false;
	while (sequenceArray.length > 0) {
		//Read block size
		blockLength = parseInt(sequenceArray.shift(), 10);
		//Empty block
		if (blockLength === 0) {
			//Switch block type
			isCompressedBlock = !isCompressedBlock;
			continue;
		}

		//Special case for compressed last block after compressed second last
		if (!isCompressedBlock && sequenceArray.length === 1) isCompressedBlock = true;
		//Special case for uncompressed last block after uncompressed second last
		else if (isCompressedBlock && isNaN(parseInt(sequenceArray[0], 10))) isCompressedBlock = false;
		//TODO: Add check for array.length === blockLength && array does not have more than 1 number left

		//Compressed block
		if (isCompressedBlock) {
			//Remove the lookback from data
			backtrack = parseInt(sequenceArray.shift(), 10);
			//Reset current block since we need its length to be 0
			currentBlock = [];
			//Calculate where in the final string the lookback starts
			backtrackStartingIndex = final.length - backtrack;
			//Loop the last ${backtrack} characters and put ${blockLength} of them in final
			while (currentBlock.length < blockLength) {
				currentBlock.push(final[backtrackStartingIndex + currentBlock.length % backtrack]);
			}
		}
		//Uncompressed block
		else {
			currentBlock = sequenceArray.splice(0, blockLength);
		}
		//Add block to result
		final = final + currentBlock.join('');
		//Switch block type
		isCompressedBlock = !isCompressedBlock;
	}
	return final;
}

/**
 * @param {string} plaintext
 * @return {string}
 */
function LZEncode(plaintext) {
	// for state[i][j]:
	//      if i is 0, we're adding a literal of length j
	//      else, we're adding a backreference of offset i and length j
	let cur_state = Array.from(Array(10), () => Array(10).fill(null));
	let new_state = Array.from(Array(10), () => Array(10));

	function set(state, i, j, str) {
		const current = state[i][j];
		if (current == null || str.length < current.length) {
			state[i][j] = str;
		} else if (str.length === current.length && Math.random() < 0.5) {
			// if two strings are the same length, pick randomly so that
			// we generate more possible inputs to Compression II
			state[i][j] = str;
		}
	}

	// initial state is a literal of length 1
	cur_state[0][1] = "";

	for (let i = 1; i < plaintext.length; ++i) {
		for (const row of new_state) {
			row.fill(null);
		}
		const c = plaintext[i];

		// handle literals
		for (let length = 1; length <= 9; ++length) {
			const string = cur_state[0][length];
			if (string == null) {
				continue;
			}

			if (length < 9) {
				// extend current literal
				set(new_state, 0, length + 1, string);
			} else {
				// start new literal
				set(new_state, 0, 1, string + "9" + plaintext.substring(i - 9, i) + "0");
			}

			for (let offset = 1; offset <= Math.min(9, i); ++offset) {
				if (plaintext[i - offset] === c) {
					// start new backreference
					set(new_state, offset, 1, string + String(length) + plaintext.substring(i - length, i));
				}
			}
		}

		// handle backreferences
		for (let offset = 1; offset <= 9; ++offset) {
			for (let length = 1; length <= 9; ++length) {
				const string = cur_state[offset][length];
				if (string == null) {
					continue;
				}

				if (plaintext[i - offset] === c) {
					if (length < 9) {
						// extend current backreference
						set(new_state, offset, length + 1, string);
					} else {
						// start new backreference
						set(new_state, offset, 1, string + "9" + String(offset) + "0");
					}
				}

				// start new literal
				set(new_state, 0, 1, string + String(length) + String(offset));

				// end current backreference and start new backreference
				for (let new_offset = 1; new_offset <= Math.min(9, i); ++new_offset) {
					if (plaintext[i - new_offset] === c) {
						set(new_state, new_offset, 1, string + String(length) + String(offset) + "0");
					}
				}
			}
		}

		const tmp_state = new_state;
		new_state = cur_state;
		cur_state = tmp_state;
	}

	let encoded = null;

	for (let len = 1; len <= 9; ++len) {
		let string = cur_state[0][len];
		if (string == null) {
			continue;
		}

		string += String(len) + plaintext.substring(plaintext.length - len, plaintext.length);
		if (encoded == null || string.length < encoded.length) {
			encoded = string;
		} else if (string.length == encoded.length && Math.random() < 0.5) {
			encoded = string;
		}
	}

	for (let offset = 1; offset <= 9; ++offset) {
		for (let len = 1; len <= 9; ++len) {
			let string = cur_state[offset][len];
			if (string == null) {
				continue;
			}

			string += String(len) + "" + String(offset);
			if (encoded == null || string.length < encoded.length) {
				encoded = string;
			} else if (string.length == encoded.length && Math.random() < 0.5) {
				encoded = string;
			}
		}
	}

	return encoded ?? "";
}

/**
 * @param {[string, number]} data
 * @return {string}
 */
function caesarCypher(data) {
	let [text, key] = data;
	return vigenereCypher([text, ALPHABET[26 - key]]);
}

/**
 * @param {[string, string]} data
 * @return {string}
 */
function vigenereCypher(data) {
	//Interpret data
	let [text, key] = data;
	let cypher = '';
	for (let i = 0; i < text.length; i++) {
		if (ALPHABET.includes(text[i].toUpperCase())) {
			const charIndex = ALPHABET.indexOf(text[i].toUpperCase());
			const keyIndex = ALPHABET.indexOf(key[i % key.length].toUpperCase());
			const cypherIndex = (charIndex + keyIndex) % ALPHABET.length;
			cypher += ALPHABET[cypherIndex];
		}
		else //For special characters
			cypher += text[i];
	}
	return cypher;
}

//------------------------------
//    <<UTILITY FUNCTIONS>>
//------------------------------

/**
 * @param {any[]} array
 * @param {number} index
 * @return {any[]}
 */
function removeAt(array, index) {
	//return array.map(x => x).splice(index, 1);
	return array.slice(0, index).concat(array.slice(index + 1));
}

/**
 * @param {any} item
 * @param {any[]} array
 * @param {number} index
 * @return {any[]}
 */
function insertAt(item, array, index) {
	//return array.map(x => x).splice(index, 0, item);
	return array.slice(0, index).concat(item).concat(array.slice(index));
}

/**
 * @param {any[]} array
 * @return {any[]}
 */
function removeDuplicates(array) {
	return [...new Set(array.map(JSON.stringify))].map(JSON.parse);
}

/**
 * @param {any} head
 * @param {any[]} tails
 * @return {any[]}
 */
function getCombinations(array) {
	const combinations = [];

	function helper(array, i, current) {
		if (i === array.length) {
			combinations.push(current);
			return;
		}
		for (var j = 0; j < array[i].length; j++) {
			helper(array, i + 1, current.concat(array[i][j]));
		}
	}

	helper(array, 0, []);
	return combinations;
}

/**
 * @param {number} depth
 * @return {number[][]}
 */
function getPascalTriangle(depth) {
	let pascal = [[1], [1, 1]];

	for (let row = 2; row < depth; row++) {
		const row = [1];
		for (let col = 1; col < row; col++)
			row.push(pascal[row - 1][col - 1] + pascal[row - 1][col]);
		row.push(1);
		pascal.push(row);
	}

	return pascal;
}

/**
 * @param {number} num
 * @return {number}
 */
function getFibonacci(num) {
	let a = 1, b = 0, temp;

	while (num >= 0) {
		temp = a;
		a = a + b;
		b = temp;
		num--;
	}

	return b;
}