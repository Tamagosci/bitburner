import { formatMoney, formatTime, getServerList, compactTail } from 'disease.js';
import { expand } from 'expand.js';
import { spread } from 'spread.js';

/** @param {NS} ns */
export async function main(ns) {
	let [spacer = 70] = ns.args;
	await devour(ns, spacer);
}

const THIS_SCRIPT_NAME = 'devour.js';
const HOME = 'home';
const SCRIPTS = ['hack.js', 'grow.js', 'weaken.js'];
const SCRIPT_COST = 1.75;
const TIME_BETWEEN_TARGET_CHANGES = 300e3;

const ongoingBatches = new Map();
let maxBatchesByRam = 0;
//For when batch updates but keeps target
let IDCounter = 0;
let IDCheckpoint = 0;
//To compensate mid run level ups
let extraDelay = 0;
let oldWeakenTime = 0;
/** @type {string[]} */
let allServers;
/** @type {string[]} */
let ramServers
/** @type {string[]} */
let targetServers;
/** @type {NetscriptPort} */
let port;
/** @type {number} */
let portID;
/** @type {HWGWBatch} */
let batch;


/** @param {NS} ns */
export async function devour(ns, spacer) {
	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(0);
	//ns.moveTail(2022, 485);
	ns.resizeTail(536, 16 * 13);
	ns.moveTail(1957, 485);

	//Safety
	ns.atExit(() => killAllOngoingBatches(ns));

	//Variables
	portID = ns.pid;
	port = ns.getPortHandle(portID);
	batch = new HWGWBatch(ns, 'home', 0.01, spacer);

	while (true) {
		//Purchase servers
		expand(ns, 0.7);

		//Nuke servers
		spread(ns);

		//Update servers
		updateServers(ns);

		//Update batch
		const oldTarget = batch.target;
		batch = findOptimalBatch(ns, spacer);
		ns.print('INFO Updated batch parameters');

		//Re-prime on target change
		if (batch.target !== oldTarget) {
			ns.print(`INFO New target is ${batch.target}`);
			killAllOngoingBatches(ns);
			port.clear();
			IDCounter = 0;
			extraDelay = 0;
			oldWeakenTime = batch.weakenTime;
			await weakenToMinSecurity(ns, batch.target);
		}

		//Update checkpoint
		IDCheckpoint = IDCounter;

		//Report batch details
		report(ns);

		//Actual batcher
		await autobatchV2(ns);
	}
}

/**
 * @param {NS} ns
 * @param {number} spacer
 * @return {HWGWBatch}
 */
function findOptimalBatch(ns, spacer) {
	const startTime = performance.now();
	const biggestRam = Math.max(...ramServers.map(server => ns.getServerMaxRam(server)));
	const batch = new HWGWBatch(ns, 'home', 0.01, spacer);
	targetServers.sort((a, b) => ns.getServerMaxMoney(b) - ns.getServerMaxMoney(a));
	//Iterate servers
	let bestTarget = 'home';
	let bestTargetPercent = 0;
	let bestTargetIncome = 0;
	for (const target of targetServers) {
		//Iterate percent
		let bestPercent = 0;
		let bestPercentIncome = 0;
		for (let i = 0.01; i <= 1; i += 0.01) {
			batch.updateAll(ns, target, i, spacer);
			if (batch.maxConcurrentBatches === 1) continue; //TODO: Remove this bandaid fix
			const batchRamCap = ramServers.reduce((total, server) => total + Math.floor(ns.getServerMaxRam(server) / batch.batchRamCost), 0);
			const newIncome = batch.getIncomePerSecond(ns) * Math.min(batchRamCap / batch.maxConcurrentBatches, 1);
			if (newIncome > bestPercentIncome && batch.batchRamCost <= biggestRam) {
				bestPercentIncome = newIncome;
				bestPercent = i;
			}
		}
		if (bestPercentIncome > bestTargetIncome) {
			bestTargetIncome = bestPercentIncome;
			bestTargetPercent = bestPercent;
			bestTarget = target;
		}
	}
	if (bestTarget === 'home') throw new Error('No valid target found!');
	batch.updateAll(ns, bestTarget, bestTargetPercent, spacer);
	maxBatchesByRam = ramServers.reduce((total, server) => total + Math.floor(ns.getServerMaxRam(server) / batch.batchRamCost), 0);
	ns.print('INFO Target selection took ' + formatTime(performance.now() - startTime));
	return batch;
}

/**
 * @param {NS} ns
 * @param {string} target
 */
async function weakenToMinSecurity(ns, target) {
	const server = ns.getServer(target);
	let weakenThreadsRequired = Math.ceil((server.hackDifficulty - server.minDifficulty) / ns.weakenAnalyze(1));
	if (weakenThreadsRequired === 0) {
		ns.print('Target is already at minimum security');
		return;
	}
	ns.print('Starting up primer...');
	for (let i = 1; weakenThreadsRequired > 0; i++) {
		ns.print(`Starting cycle n.${i} which will take ${formatTime(ns.getWeakenTime(target))}`);
		for (const server of ramServers) {
			const threadsServerCanFit = Math.floor((ns.getServerMaxRam(server) - ns.getServerUsedRam(server)) / SCRIPT_COST);
			ns.scp(SCRIPTS, server, HOME);
			ns.exec('weaken.js', server, Math.min(threadsServerCanFit, weakenThreadsRequired), target);
			weakenThreadsRequired -= threadsServerCanFit;
			if (weakenThreadsRequired <= 0) break;
		}
		await ns.sleep(ns.getWeakenTime(target));
	}
}

/** @param {NS} ns */
async function autobatchV2(ns) {
	//Start a timer
	let shouldContinue = true;
	setTimeout(() => shouldContinue = false, TIME_BETWEEN_TARGET_CHANGES);
	//Startup details
	let startupCompleted = false;
	let hackJobsToSkip = calculateHackJobsToSkip(ns);
	const lowestCap = Math.min(maxBatchesByRam, batch.maxConcurrentBatches);
	while (shouldContinue) {
		//Wait until there is room
		if (startupCompleted) await port.nextWrite();
		else await ns.sleep(batch.batchWindow);
		//Remove finished batches from log
		let concludedID
		while (!port.empty()) {
			concludedID = port.read();
			if (ongoingBatches.has(concludedID)) ongoingBatches.delete(concludedID);
			//if (port.empty() && ID >= IDCheckpoint) startupCompleted = true; //Should not need, but keep for safety
		}
		if (concludedID < IDCheckpoint && startupCompleted) continue;
		//Cancel recalculate threads and add extra delay if levelled up
		checkAndCompensateForLevelUps(ns);
		//Cancel next hack if money is not at max
		checkAndCompensateForMoneyCollisions(ns);
		//Create new batch
		const serverToUseAsHost = ramServers.find((server) => ns.getServerMaxRam(server) - ns.getServerUsedRam(server) >= batch.batchRamCost)
		if (serverToUseAsHost === undefined) continue; //Not enough ram, can happen in edge cases
		deployBatch(ns, serverToUseAsHost, (hackJobsToSkip-- > 0));
		//Leave startup mode
		if (startupCompleted === false && hackJobsToSkip <= 0 && ongoingBatches.size >= lowestCap) startupCompleted = true;
	}
}

/** @param {NS} ns */
function calculateHackJobsToSkip(ns) {
	const target = ns.getServer(batch.target);
	if (target.moneyAvailable === target.moneyMax) return 0;
	target.hackDifficulty = target.minDifficulty; //TODO: Should not matter anymore
	const growThreadsToMaxMoney = ns.formulas.hacking.growThreads(target, batch.player, target.moneyMax);
	return Math.ceil(growThreadsToMaxMoney / batch.growThreads);
}

/** @param {NS} ns */
function updateServers(ns) {
	allServers = getServerList(ns, !(ns.getPurchasedServers().length > 0));
	ramServers = allServers.filter(server => ns.getServerMaxRam(server) > 0 && ns.hasRootAccess(server));
	ramServers.sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));
	const hackingLevel = ns.getPlayer().skills.hacking;
	targetServers = allServers.filter(server => ns.getServerRequiredHackingLevel(server) <= hackingLevel && ns.hasRootAccess(server));
}

/** @param {NS} ns */
function killAllOngoingBatches(ns) {
	if (ongoingBatches.size > 0) ns.print('WARN Killing batches, it might freeze!');
	for (const [key, pids] of ongoingBatches.entries()) {
		if (pids.hack !== undefined) ns.kill(pids.hack);
		if (pids.weaken1 !== undefined) ns.kill(pids.weaken1);
		ns.kill(pids.grow);
		ns.kill(pids.weaken2);
		ongoingBatches.delete(key);
	}
}

/** @param {NS} ns */
function checkAndCompensateForLevelUps(ns) {
	const newWeakenTime = ns.getWeakenTime(batch.target);
	if (newWeakenTime >= oldWeakenTime) return;
	//Different weaken time means level up means hack is too strong now
	batch.updateThreadCounts(ns, batch.percentToHack);
	//Calculate extra delay to avoid future collisions
	extraDelay += oldWeakenTime - newWeakenTime;
	oldWeakenTime = newWeakenTime;
}

/** @param {NS} ns */
function checkAndCompensateForMoneyCollisions(ns) {
	const currentMoney = ns.getServerMoneyAvailable(batch.target);
	if (currentMoney === batch.primed.moneyMax) return;
	const oldestEntry = ongoingBatches.entries().next();
	if (oldestEntry.done) return;
	const [key, pids] = oldestEntry.value;
	if (pids.hack === undefined) return;
	ns.kill(pids.hack);
	pids.hack = undefined;
	ongoingBatches.set(key, pids);
}

/** 
 * @param {NS} ns 
 * @param {string} host
 * @param {boolean} skipHack
 */
function deployBatch(ns, host, skipHack = false) {
	ns.scp(SCRIPTS, host, 'home');
	const pids = {};
	if (!skipHack) {
		pids.hack = ns.exec('hack.js', host, batch.hackThreads, batch.target, batch.hackDelay + extraDelay, false, IDCounter);
		pids.weaken1 = ns.exec('weaken.js', host, batch.weaken1Threads, batch.target, batch.weaken1Delay + extraDelay, false, 0, IDCounter);
	}
	pids.grow = ns.exec('grow.js', host, batch.growThreads, batch.target, batch.growDelay + extraDelay, false, IDCounter);
	pids.weaken2 = ns.exec('weaken.js', host, batch.weaken2Threads, batch.target, batch.weaken2Delay + extraDelay, false, portID, IDCounter);
	if (pids.grow === 0) throw new Error('ERROR Failed to launch grow n.' + IDCounter);
	if (pids.weaken2 === 0) throw new Error('ERROR Failed to launch weaken 2 n.' + IDCounter);
	ongoingBatches.set(IDCounter++, pids);
	if (extraDelay > 0) extraDelay -= Math.min(batch.batchSpacer / 2, extraDelay);
}

/** @param {NS} ns */
function report(ns) {
	//╔═╗╚╝║╠╣╟╢╤╧╪─│┬┴┼▲▼■□
	//Possible width 9.735 * characters
	//Calculations
	const target = batch.target.padStart((26 - batch.target.length) / 2 + batch.target.length, ' ').padEnd(26, ' ');
	const percentToHack = ns.formatPercent(batch.percentToHack, 0).padStart(4, ' ');
	const hackChance = ns.formatPercent(batch.hackChance, 0).padStart(4, ' ');
	const spacer = (batch.jobSpacer + ' / ' + batch.batchSpacer + ' / ' + batch.batchWindow).padStart(13, ' ');
	const batchRamCost = ns.formatRam(batch.batchRamCost, 0).padStart(6, ' ') + '/ea';
	const timeCap = batch.maxConcurrentBatches.toString().padStart(11, ' ');
	const ramCap = maxBatchesByRam.toString().padStart(9, ' ');
	const ramToTimePercentValue = Math.min(maxBatchesByRam / batch.maxConcurrentBatches, 1);
	const ramToTimePercent = ns.formatPercent(ramToTimePercentValue, 0).padStart(4, ' ');
	const income = ('$' + formatMoney(batch.getIncomePerSecond(ns) * ramToTimePercentValue, 2) + '/s').padStart(13, ' ');
	const duration = formatTime(batch.batchTime, true).padStart(9, ' ');
	//Actual report
	ns.print('╔════════════════════════╤════════════════════════════╗'); //55
	ns.print(`║         Target         │ ${target} ║`);
	ns.print('╟─────────────────┬──────┼─────────────────────┬──────╢');
	ns.print(`║ Percent to hack │ ${percentToHack} │ Hack success chance │ ${hackChance} ║`);
	ns.print('╟────────┬────────┴──────┼────────────────┬────┴──────╢');
	ns.print(`║ Spacer │ ${spacer} │ Batch ram cost │ ${batchRamCost} ║`);
	ns.print('╟────────┴─┬─────────────┼─────────┬──────┴────┬──────╢');
	ns.print(`║ Time cap │ ${timeCap} │ Ram cap │ ${ramCap} │ ${ramToTimePercent} ║`);
	ns.print('╟────────┬─┴─────────────┼─────────┴──────┬────┴──────╢');
	ns.print(`║ Income │ ${income} │ Batch duration │ ${duration} ║`);
	ns.print('╚════════╧═══════════════╧════════════════╧═══════════╝'); //55
	//Resize tail
	ns.resizeTail(536, 16 * 13);
	compactTail(THIS_SCRIPT_NAME);
}

/**
 * @param {NS} ns
 * @param {HWGWBatch} batch
 */

class HWGWBatch {
	jobSpacer = 10;

	/** 
	 * @param {NS} ns
	 * @param {string} target
	 * @param {number} percentToHack
	 * @param {number} batchSpacer
	 */
	constructor(ns, target, percentToHack, batchSpacer) {
		this.updateAll(ns, target, percentToHack, batchSpacer);
	}

	/** 
	 * @param {NS} ns
	 * @param {string} target
	 * @param {number} percentToHack
	 * @param {number} batchSpacer
	 */
	updateAll(ns, target, percentToHack, batchSpacer) {
		if (batchSpacer < this.jobSpacer)
			throw new RangeError(`Provided ${batchSpacer} as the batch spacer, it should be >= ${this.jobSpacer}.`);
		this.batchSpacer = batchSpacer;
		this.batchWindow = batchSpacer + this.jobSpacer * 3;
		this.changeTarget(ns, target);
		this.updateThreadCounts(ns, percentToHack);
		this.updateTimings(ns);
	}

	/** 
	 * @param {NS} ns
	 * @param {string} target
	 */
	changeTarget(ns, target) {
		if (ns.serverExists(target) === false)
			throw new Error(`Provided ${target} as a server, but no such server exists.`);
		this.target = target;
		this.primed = ns.getServer(target);
		this.primed.moneyAvailable = this.primed.moneyMax;
		this.primed.hackDifficulty = this.primed.minDifficulty;
	}

	/** 
	 * @param {NS} ns
	 * @param {number} percentToHack
	 */
	updateThreadCounts(ns, percentToHack) {
		if (percentToHack <= 0 || percentToHack > 1)
			throw new RangeError(`Provided ${percentToHack} as percentage to hack, it should be included between 0 (excluded) and 1 (included).`);
		this.percentToHack = percentToHack;
		this.player = ns.getPlayer();
		//Hack
		this.hackChance = ns.formulas.hacking.hackChance(this.primed, this.player);
		this.hackPower = ns.formulas.hacking.hackPercent(this.primed, this.player);
		this.hackThreads = Math.max(Math.floor(this.percentToHack / this.hackPower), 1);
		//Weaken 1
		this.weakenPower = ns.weakenAnalyze(1);
		this.weaken1Threads = Math.ceil(ns.hackAnalyzeSecurity(this.hackThreads) / this.weakenPower);
		//Grow
		this.primed.moneyAvailable = Math.max(this.primed.moneyMax * (1 - this.hackPower * this.hackThreads), 0);
		this.growThreads = ns.formulas.hacking.growThreads(this.primed, this.player, this.primed.moneyMax);
		this.primed.moneyAvailable = this.primed.moneyMax;
		//Weaken 2
		this.weaken2Threads = Math.ceil(ns.growthAnalyzeSecurity(this.growThreads) / this.weakenPower);
		//Ram cost
		this.hackRamCost = 1.75 * this.hackThreads;
		this.growRamCost = 1.75 * this.growThreads;
		this.weaken1RamCost = 1.75 * this.weaken1Threads;
		this.weaken2RamCost = 1.75 * this.weaken2Threads;
		this.batchRamCost = this.hackRamCost + this.growRamCost + this.weaken1RamCost + this.weaken2RamCost;
	}

	/** @param {NS} ns */
	updateTimings(ns) {
		//Job durations
		this.hackTime = ns.formulas.hacking.hackTime(this.primed, this.player);
		this.growTime = ns.formulas.hacking.growTime(this.primed, this.player);
		this.weakenTime = ns.formulas.hacking.weakenTime(this.primed, this.player); //TODO: Add a real min value
		this.batchTime = this.weakenTime + this.jobSpacer * 2;
		//Job delays
		this.hackDelay = Math.max(this.weakenTime - this.hackTime - this.jobSpacer, 0);
		this.weaken1Delay = 0;
		this.growDelay = this.weakenTime - this.growTime + this.jobSpacer;
		this.weaken2Delay = this.jobSpacer * 2;
		//Concurrent batches
		this.maxConcurrentBatches = Math.max(Math.floor(this.weakenTime / this.batchWindow), 1);
	}

	/** @param {NS} ns */
	getIncomePerSecond(ns) {
		return this.primed.moneyMax
			* this.percentToHack
			* this.hackChance
			* (1000 / this.batchWindow);
	}
}