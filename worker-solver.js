//Some code copied/inspired by jeek
//https://github.com/jeek/jeek.js/blob/dev/Contracts.js

const SOLUTIONS = {
	'Find Largest Prime Factor': largestPrimeFactor,
	'Subarray with Maximum Sum': null,
	'Total Ways to Sum': waysToSumI,
	'Total Ways to Sum II': waysToSumII,
	'Spiralize Matrix': spiralizeMatrix,
	'Array Jumping Game': null,
	'Array Jumping Game II': null,
	'Merge Overlapping Intervals': null,
	'Generate IP Addresses': generateIPs,
	'Algorithmic Stock Trader I': null,
	'Algorithmic Stock Trader II': null,
	'Algorithmic Stock Trader III': stonksIII,
	'Algorithmic Stock Trader IV': null,
	'Minimum Path Sum in a Triangle': triangleMinPathSum,
	'Unique Paths in a Grid I': null,
	'Unique Paths in a Grid II': null,
	'Shortest Path in a Grid': null,
	'Sanitize Parentheses in Expression': sanitizeParentheses,
	'Find All Valid Math Expressions': null,
	'HammingCodes: Integer to Encoded Binary': null,
	'HammingCodes: Encoded Binary to Integer': null,
	'Proper 2-Coloring of a Graph': twoColorGraph,
	'Compression I: RLE Compression': compressRLE,
	'Compression II: LZ Decompression': null,
	'Compression III: LZ Compression': null,
	'Encryption I: Caesar Cipher': vigenereCypher,
	'Encryption II: Vigenère Cipher': vigenereCypher,
	'Unkown': null,
	'Undefined': undefined
};

const DEFAULT_ERROR = 'ERROR This should never be seen';
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
 * @param {number[][]} matrix
 * @return {number[]}
 */
function spiralizeMatrix(matrix) {
	let rows = matrix.length;
	let columns = matrix[0].length;
	let result = [];
	while (rows > 0 || columns > 0) {
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
 * @param {string} sequence
 * @return {string[]}
 */
function generateIPs(sequence) {
	let combinations = [];
	//Bruteforce combinations, right and wrong
	for (let i = 1; i + 1 < sequence.length; i++) {
		for (let j = i + 1; j + 1 < sequence.length; j++) {
			for (let k = j + 1; k < sequence.length; k++) { //Not convinced about short ips like 1.1.1.1
				combinations.push([sequence.substring(0, i), sequence.substring(i, j), sequence.substring(j, k), sequence.substring(k)]);
			}
		}
	}
	//Filter out bad combos
	for (let i = 0; i < 4; i++) {
		combinations = combinations.filter(x => parseInt(x[i]) >= 0 && parseInt(x[i]) <= 255
			&& (x[i] == "0" || x[i].substring(0, 1) != "0")); //This checks for leading zeros
	}
	return combinations.map(x => x.join("."));
}

/**
 * @param {string} sequence
 * @return {string[]}
 */
function sanitizeParentheses(sequence) {
	const possibilities = [];
	//Remove trailing '('
	for (let i = sequence.length - 1; i >= 0; i--)
		if (sequence[i] === '(')
			sequence.splice(i, 1);
	//Bruteforce it
	for (const i in sequence)
		possibilities.push(removeAt(sequence, i));
	//Remove duplicates
	const uniques = removeDuplicates(possibilities);
	//Remove illegal
	const valid = uniques.filter(function (expression) {
		let opened = 0;
		for (const char of expression) {
			if (char === '(') opened++;
			else if (char === ')') opened--;
		}
		return opened === 0;
	});
	return valid;
}

/**
 * @param {any[]} array
 * @param {number} index
 * @return {any[]}
 */
function removeAt(array, index) {
	return array.slice(0, index).concat(arrayOfLetters.slice(index + 1));
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
 * @param {string} data Formatted as TEXTTEXT,KEY
 * @return {string}
 */
function vigenereCypher(data) {
	//Interpret data
	let [text, key] = data;
	if (typeof key == "number") key = ALPHABET[26 - key]; //Caesar compatibility
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

/**
 * @param {[number, number[]]} graph
 * @return {number[]}
 */
function twoColorGraph(graph) {
	//Interpret data
	const [count, vertices] = graph;
	//Setup colors
	const colors = new Array(count).fill(-1);

	//Color it
	for (let i = 0; i < count; i++) {
		const edges = vertices[i];
		//Find vertices which share one side
		const adjacentVertices = vertices.filter((vertex) =>
			vertex.includes(edges[0]) || vertex.includes(edges[1]));

		//Get their colors
		const adjacentColors = adjacentVertices.map((vertex) => colors[vertices.indexOf(vertex)]);

		//Color current vertex
		if (adjacentColors.every((color) => color !== 0))
			colors[i] = 0;
		else if (adjacentColors.every((color) => color !== 1))
			colors[i] = 1;
		else
			return [];
	}

	return colors;
}

/**
 * @param {string} sequence
 * @return {string}
 */
function compressRLE(sequence) {
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

function compressLZ(sequence) {
	let compressed = '';

}

function decompressLZ(sequence) {
	//TODO: Remake myself
	//Courtesy of jeek
	if (sequence.length == 0) {
		return "";
	}
	sequence = sequence.split("");
	let answer = "";
	while (sequence.length > 0) {
		let chunklength = parseInt(sequence.shift());
		if (chunklength > 0) {
			answer = answer.concat(sequence.splice(0, chunklength).join(""));
		}
		if (sequence.length > 0) {
			chunklength = parseInt(sequence.shift());
			if (chunklength != 0) {
				let rewind = parseInt(sequence.shift());
				for (let i = 0; i < chunklength; i++) {
					answer = answer.concat(answer[answer.length - rewind]);
				}
			}
		}
	}
	return answer;
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
	const [num, options] = data;
	const subProblems = new Array(num + 1).fill(0);
	subProblems[0] = 1;

	for (let i = 1; i < options.length; i++) {
		for (let o = options[i]; o <= num; o++) {
			subProblems[o] += subProblems[o - options[i]];
		}
	}

	return subProblems[num];
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

function stonksIII(prices) {
	let buy1 = -prices[0];
	let sell1 = 0;
	let buy2 = -prices[0];
	let sell2 = 0;

	for (let i = 1; i < prices.length; i++) {
		buy1 = Math.max(buy1, -prices[i]);
		sell1 = Math.max(sell1, buy1 + prices[i]);
		buy2 = Math.max(buy2, sell1 - prices[i]);
		sell2 = Math.max(sell2, buy2 + prices[i]);
	}

	return sell2;
}