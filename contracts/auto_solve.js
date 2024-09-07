import { getServerList, formatTime } from 'utils.js';

const WORKER_SLEEP = 1e3;
const CONTRACT_SLEEP = 300e3;

const WORKER_SCRIPT = 'contracts/worker_solver.js'; // <<--- Actual solvers are there

/** @param {NS} ns */
export async function main(ns) {
	let [loop = true] = ns.args;
	//ns.codingcontract.createDummyContract('Find Largest Prime Factor');
	await solve(ns, loop);
}

/** 
 * @param {NS} ns
 * @param {boolean} loop
 */
async function solve(ns, loop) {
	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(0);
	ns.resizeTail(640, 234);
	ns.moveTail(1317, 1118);

	//Time keeper
	const startTime = performance.now();
	ns.printf('StartTime: %s', formatTime(startTime));

	//Make a worker blob
	const workerCode = ns.read(WORKER_SCRIPT);
	const workerBlob = new Blob([workerCode], { type: "application/javascript" });
	const workerURL = URL.createObjectURL(workerBlob);

	do {
		//Locate contracts
		const contracts = findContracts(ns);

		//Safety
		ns.atExit(() => contracts.forEach(contract => contract.worker.terminate()));

		//Just to make sure we found something or not
		if (contracts.length > 0) {
			ns.printf('WARN Found %s contracts.', contracts.length);
			contracts.forEach(contract => ns.print('Type: ' + contract.contractType));
		}
		else {
			const timePassedRounded = Math.floor((performance.now() - startTime) / 1000) * 1000;
			ns.print(`WARN No contracts found. (${formatTime(timePassedRounded)})`);
		}

		//Solve contracts
		for (const contract of contracts)
			contract.startSolver(workerURL);

		//Wait for workers to finish
		if (contracts.length > 0)
			ns.print('Waiting for workers to finish...');
		for (let i = 1; contracts.some(contract => contract.solution === undefined); i++) {
			await ns.sleep(WORKER_SLEEP);
			const incompleteContracts = contracts.filter(contract => contract.solution === undefined);
			if (incompleteContracts.length > 0) {
				ns.printf('Time waited: %s', formatTime(WORKER_SLEEP * i));
				ns.print(`${incompleteContracts.length} contracts are still processing:`);
				incompleteContracts.forEach(contract => ns.print(`>${contract.contractType}`));
			}
		}

		//Submit solutions
		for (const contract of contracts) {
			contract.worker.terminate();
			contract.trySolution(ns);
		}

		//Wait until more contracts are generated
		if (loop)
			await ns.sleep(CONTRACT_SLEEP);
	} while (loop);
}

/** 
 * @param {NS} ns 
 * @return {Contract[]}
 */
function findContracts(ns) {
	const contracts = [];
	for (const server of getServerList(ns, true)) {
		for (const contract of ns.ls(server, '.cct')) {
			contracts.push(new Contract(ns, server, contract));
		}
	}
	return contracts;
}

export class Contract {
	/**
	 * @param {NS} ns
	 * @param {string} host
	 * @param {string} filename
	 */
	constructor(ns, host, filename) {
		this.server = host;
		this.filename = filename;
		this.contractType = ns.codingcontract.getContractType(filename, host);
		this.data = ns.codingcontract.getData(filename, host);
	}

	/** @param {NS} ns */
	report(ns) {
		ns.print('<CONTRACT>');
		ns.printf('  Server: %s', this.server);
		ns.printf('  File: %s', this.filename);
		ns.printf('  Type: %s', this.contractType);
		ns.printf('  Data: %s', JSON.stringify(this.data));
		ns.printf('  Solution: %s', JSON.stringify(this.solution));
		ns.printf('  Response: %s', this.response);
	}

	startSolver(workerURL) {
		//Create worker
		this.worker = new Worker(workerURL);
		//Establish what to do when worker finishes
		this.worker.onmessage = (event) => {
			this.solution = event.data.solution;
		}
		//Start worker
		this.worker.postMessage({
			contractType: this.contractType,
			parameters: this.data
		});
	}

	/** @param {NS} ns */
	trySolution(ns) {
		if ((typeof this.solution === 'string' && this.solution.startsWith('ERROR'))
			|| this.solution === undefined)
			this.response = this.solution;
		else {
			this.remainingTries = ns.codingcontract.getNumTriesRemaining(this.filename, this.server) - 1;
			//ns.print(`DEBUG Trying contract ${this.filename} on ${this.server}:\n${this.solution}`);
			this.response = ns.codingcontract.attempt(this.solution, this.filename, this.server);
			if (this.response === '')
				this.response = this.remainingTries + ' tries remaining';
		}
		this.report(ns);
	}
}