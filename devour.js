import { formatMoney, formatTime, getServerList, compactTail } from 'utils.js';
import { upgradeHomeAndBuyPrograms } from 'home.js';
import { expandServers } from 'servers.js';
import { spread } from 'spread.js';

/** @param {NS} ns */
export async function main(ns) {
	let [spacer = 70] = ns.args;
	await devour(ns, spacer);
}

const DEBUG_MODE = false;
const THIS_SCRIPT_NAME = 'devour.js';
const HOME = 'home';
const SCRIPTS = ['hack.js', 'grow.js', 'weaken.js'];
const SCRIPT_COST = 1.75;
const MIN_TIME_BETWEEN_BATCH_RECALCULATIONS = 300e3;
const MIN_CYCLES_BETWEEN_BATCH_RECALCULATIONS = 3;
const EXTRA_DELAY_DECAY_SPEED = 5; //Integer [1-batchSpacer]

const ongoingBatches = new Map();
//Batch identifier
let IDCounter = 0;
//To compensate mid run level ups
let extraDelay = 0;
let oldWeakenTime = 0;
/** @type {string[]} */
let allServers;
/** @type {string[]} */
let ramServers;
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
	ns.moveTail(1957, 484);

	//Safety
	ns.atExit(() => reset(ns));

	//Variables setup
	portID = ns.pid;
	port = ns.getPortHandle(portID);
	batch = new HWGWBatch(ns, 'home', 0.01, spacer);

	while (true) {
		//Upgrade home
		await upgradeHomeAndBuyPrograms(ns);

		//Purchase servers
		expandServers(ns);

		//Nuke servers
		spread(ns);

		//Update servers
		updateServers(ns);

		//Update batch
		const oldTarget = batch.target;
		batch = findOptimalBatch(ns, spacer);
		ns.print('INFO Updated batch parameters');
		ns.print(`INFO New target is ${batch.target}`);

		//Prime security
		if (batch.target != oldTarget) {
			reset(ns);
			await weakenToMinSecurity(ns, batch.target);
			batch.updateAll(ns, batch.target, batch.percentToHack, batch.batchSpacer);
			oldWeakenTime = batch.weakenTime;
			shotgunStartup(ns);
		}

		//Report batch details
		report(ns);

		//Actual batcher
		await autobatchV3(ns);
	}
}

/** @param {NS} ns */
function reset(ns) {
	killAllOngoingBatches(ns);
	port.clear();
	IDCounter = 0;
	extraDelay = 0;
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
			if (Math.min(batch.maxConcurrentBatchesByTime, batch.maxConcurrentBatchesByRam) <= 1) continue; //TODO: Properly fix underlying problem and remove
			const newIncome = batch.getIncomePerSecond(ns, true);
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
	if (bestTarget === 'home') {
		ns.print('ERROR No valid target found!');
		ns.print('WARN Switching to v1 joesguns to gain initial xp and founds!');
		ns.exec('v1.js', 'home', 1, 'joesguns');
		ns.exit();
		//throw new Error('No valid target found!');
	}
	batch.updateAll(ns, bestTarget, bestTargetPercent, spacer);
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
	for (let i = 1; weakenThreadsRequired > 0; i++) {
		ns.print(`Starting priming cycle ${i} which will take ${formatTime(ns.getWeakenTime(target))}`);
		for (const server of ramServers) {
			const threadsServerCanFit = Math.floor((ns.getServerMaxRam(server) - ns.getServerUsedRam(server)) / SCRIPT_COST);
			if (threadsServerCanFit === 0) continue;
			ns.scp(SCRIPTS, server, HOME);
			ns.exec('weaken.js', server, Math.min(threadsServerCanFit, weakenThreadsRequired), target);
			weakenThreadsRequired -= threadsServerCanFit;
			if (weakenThreadsRequired <= 0) break;
		}
		await ns.sleep(ns.getWeakenTime(target));
	}
}

/** @param {NS} ns */
function shotgunStartup(ns) {
	const homeUsedRam = ns.getServerUsedRam('home');
	const maxBatchCount = Math.min(batch.maxConcurrentBatchesByRam, batch.maxConcurrentBatchesByTime);
	shotgunDeploy(ns, maxBatchCount - ongoingBatches.size, calculateHackJobsToSkip(ns))
	//Relay info
	ns.print(`INFO Deployed ${ongoingBatches.size} of ${maxBatchCount} batches. (${ns.formatPercent(ongoingBatches.size / maxBatchCount, 1)})`);
	if (ongoingBatches.size < maxBatchCount) {
		const homeTotalRam = ns.getServerMaxRam('home');
		const homeMaxBatches = Math.floor(homeTotalRam / batch.batchRamCost);
		const homeActualBatches = Math.floor((homeTotalRam - homeUsedRam) / batch.batchRamCost)
		const homeMissingBatches = homeMaxBatches - homeActualBatches;
		ns.print(`INFO ${homeMissingBatches} of the missing batches were supposed to run on home.`);
	}
}

/** @param {NS} ns */
async function autobatchV3(ns) {
	//Start a timer
	let shouldContinue = true;
	const timeout = Math.max(MIN_TIME_BETWEEN_BATCH_RECALCULATIONS, MIN_CYCLES_BETWEEN_BATCH_RECALCULATIONS * batch.batchTime);
	setTimeout(() => shouldContinue = false, timeout);
	//Things which need to be calculated only once
	let maxBatchCount = Math.min(batch.maxConcurrentBatchesByRam, batch.maxConcurrentBatchesByTime);
	//Used to repopulate
	let lastIDStartTime = 0;
	while (shouldContinue) {
		//Force reset in startup failed, usually from reloading the save
		if (ongoingBatches.size === 0) {
			batch.target = 'home';
			await ns.sleep(1e3); //Avoid infinite loop if ram is occupied
			return;
		}
		//Wait until there is room
		await port.nextWrite();
		//Remove finished batches from log
		let concludedID = port.read();
		lastIDStartTime = ongoingBatches.get(concludedID).startTime;
		ongoingBatches.delete(concludedID);
		// v DEBUG v 
		//This should not happen anymore, keeping just in case
		while (!port.empty()) {
			ns.print('ERROR Port should be empty but it\'s not!');
			concludedID = port.read();
			ongoingBatches.delete(concludedID);
		}
		//Recalculate threads and add extra delay if levelled up
		checkAndCompensateForLevelUps(ns);
		maxBatchCount = Math.min(batch.maxConcurrentBatchesByRam, batch.maxConcurrentBatchesByTime);
		//Cancel next hack/grow if money is not at max
		checkAndCompensateForCollisions(ns);
		//Skip if security > min
		if (ns.getServerSecurityLevel(batch.target) > batch.primed.minDifficulty) {
			if (DEBUG_MODE) ns.print(`WARN Skipping ${IDCounter++} because security is too high`)
			continue;
		}
		//Avoid creating too many batches
		if (ongoingBatches.size >= batch.maxConcurrentBatchesByTime) {
			if (DEBUG_MODE) ns.print(`WARN Skipping ${IDCounter++} because we overdeployed`);
			continue;
		}
		//Create new batch
		const serverToUseAsHost = ramServers.find((server) => ns.getServerMaxRam(server) - ns.getServerUsedRam(server) >= batch.batchRamCost)
		if (serverToUseAsHost === undefined) {
			//ns.print(`WARN Skipping ${IDCounter++} because not enough ram`); //This should only happen when increasing hack%
			continue; //Not enough ram, can happen in edge cases (EDIT: In theory only on home now)
		}
		deployBatch(ns, serverToUseAsHost);
		//Add extra batches with extra delay if conditions allow as repopulation technique
		if (ongoingBatches.size < maxBatchCount) {
			const howManyBatchesWouldFitBeforeNextPortWrite = Math.floor((ongoingBatches.values().next().value.startTime ?? Infinity - lastIDStartTime) / batch.batchWindow) - 2;
			if (howManyBatchesWouldFitBeforeNextPortWrite > 0) {
				const howManyBatchesThatWouldFitDoIReallyNeed = Math.min(howManyBatchesWouldFitBeforeNextPortWrite, maxBatchCount - ongoingBatches.size)
				if (DEBUG_MODE) ns.print(`INFO Repopulating ${howManyBatchesThatWouldFitDoIReallyNeed} batches`);
				const succeeded = shotgunDeploy(ns, howManyBatchesThatWouldFitDoIReallyNeed);
				if (DEBUG_MODE) ns.print(`INFO Managed to create ${succeeded}`);
				if (DEBUG_MODE) ns.print(`DEBUG Currently ${ongoingBatches.size} / ${maxBatchCount}`);
				if (!DEBUG_MODE && succeeded > 0) report(ns);
			}
		}
	}
}

/** @param {NS} ns */
function calculateHackJobsToSkip(ns) {
	const target = ns.getServer(batch.target);
	if (target.moneyAvailable === target.moneyMax) return 0;
	const growThreadsToMaxMoney = ns.formulas.hacking.growThreads(target, batch.player, target.moneyMax);
	return Math.ceil(growThreadsToMaxMoney / batch.growThreads);
}

/** @param {NS} ns */
function updateServers(ns) {
	allServers = getServerList(ns, false);
	ramServers = allServers.filter(server => ns.getServerMaxRam(server) > 0 && ns.hasRootAccess(server) && ns.scp(SCRIPTS, server, 'home') !== undefined);
	ramServers.sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));
	ramServers.push('home'); //Adding home after the sort makes sure it's only used as a last resort
	const hackingLevel = ns.getPlayer().skills.hacking;
	targetServers = allServers.filter(server => ns.getServerRequiredHackingLevel(server) <= hackingLevel && ns.hasRootAccess(server));
}

/** @param {NS} ns */
function killAllOngoingBatches(ns) {
	if (ongoingBatches.size > 0) ns.print('WARN Killing batches, it might freeze!');
	for (const [key, pids] of ongoingBatches.entries()) {
		if (pids.hack !== undefined) ns.kill(pids.hack);
		ns.kill(pids.weaken1);
		if (pids.grow !== undefined) ns.kill(pids.grow);
		ns.kill(pids.weaken2);
		ongoingBatches.delete(key);
		port.read();
	}
}

/** @param {NS} ns */
function checkAndCompensateForLevelUps(ns) {
	const newWeakenTime = ns.getWeakenTime(batch.target);
	if (newWeakenTime >= oldWeakenTime) return;
	//Different weaken time means level up means hack is too strong now
	batch.updateAll(ns, batch.target, batch.percentToHack, batch.batchSpacer);
	//Calculate extra delay to avoid future collisions
	extraDelay += oldWeakenTime - newWeakenTime;
	//if (newWeakenTime - oldWeakenTime >= 1000) report(ns);
	oldWeakenTime = newWeakenTime;
	report(ns);
}

/** @param {NS} ns */
function checkAndCompensateForCollisions(ns) {
	const needToIncreaseMoney = ns.getServerMoneyAvailable(batch.target) < batch.primed.moneyMax;
	const needToDecreaseSecurity = ns.getServerSecurityLevel(batch.target) > batch.primed.minDifficulty;
	if (!needToIncreaseMoney && !needToDecreaseSecurity) return;
	const oldestEntry = ongoingBatches.entries().next();
	if (oldestEntry.done) return;
	const [key, pids] = oldestEntry.value;
	if ((needToIncreaseMoney || needToDecreaseSecurity) && pids.hack !== undefined) {
		ns.kill(pids.hack);
		pids.hack = undefined;
	}
	//TODO: vv Might no longer be needed vv
	if (needToDecreaseSecurity && pids.grow !== undefined) {
		if (DEBUG_MODE) ns.print('DEBUG Had to skip a grow because security too high')
		ns.kill(pids.grow);
		pids.grow = undefined;
	}
	ongoingBatches.set(key, pids);
}

/**
 * @param {NS} ns
 * @param {number} amount
 * @param {number} hackJobsToSkip
 */
function shotgunDeploy(ns, amount, hackJobsToSkip = 0) {
	const originalExtraDelay = extraDelay;
	let batchesDeployed = 0;
	for (const server of ramServers) {
		while (batchesDeployed < amount && ns.getServerMaxRam(server) - ns.getServerUsedRam(server) >= batch.batchRamCost) {
			deployBatch(ns, server, (batchesDeployed++ < hackJobsToSkip), false);
			extraDelay += batch.batchWindow;
		}
	}
	extraDelay = originalExtraDelay;
	return batchesDeployed;
}

/** 
 * @param {NS} ns 
 * @param {string} host
 * @param {boolean} skipHack
 * @param {boolean} decayExtraDelay
 */
function deployBatch(ns, host, skipHack = false, decayExtraDelay = true) {
	const pids = {};
	if (skipHack) {
		pids.weaken1 = ns.exec('weaken.js', host, batch.weaken1Threads + batch.hackThreads, batch.target, batch.weaken1Delay + extraDelay, false, 0, IDCounter);
	}
	else {
		pids.hack = ns.exec('hack.js', host, batch.hackThreads, batch.target, batch.hackDelay + extraDelay, false, IDCounter);
		pids.weaken1 = ns.exec('weaken.js', host, batch.weaken1Threads, batch.target, batch.weaken1Delay + extraDelay, false, 0, IDCounter);
	}
	pids.grow = ns.exec('grow.js', host, batch.growThreads, batch.target, batch.growDelay + extraDelay, false, IDCounter);
	pids.weaken2 = ns.exec('weaken.js', host, batch.weaken2Threads, batch.target, batch.weaken2Delay + extraDelay, false, portID, IDCounter);
	if (pids.weaken1 === 0 || pids.grow === 0 || pids.weaken2 === 0) {
		const message = 'ERROR Failed to launch batch n.' + IDCounter;
		reset(ns);
		throw new Error(message);
	}
	pids.startTime = performance.now();
	ongoingBatches.set(IDCounter++, pids);
	if (extraDelay > 0 && decayExtraDelay) extraDelay -= Math.min(EXTRA_DELAY_DECAY_SPEED, extraDelay);
}

/** @param {NS} ns */
function report(ns) {
	//╔═╗╚╝║╠╣╟╢╤╧╪─│┬┴┼▲▼■□
	//Possible width 9.735 * characters
	//Calculations
	const target = batch.target.toUpperCase().padStart((26 - batch.target.length) / 2 + batch.target.length, ' ').padEnd(26, ' '); //Centered version
	const percentToHack = ns.formatPercent(batch.percentToHack, 0).padStart(4, ' ');
	const hackChance = ns.formatPercent(batch.hackChance, 0).padStart(4, ' ');
	const spacer = (batch.jobSpacer + ' / ' + batch.batchSpacer + ' / ' + batch.batchWindow).padStart(15, ' ');
	const batchRamCost = ns.formatRam(batch.batchRamCost, 0).padStart(6, ' ') + '/ea';
	const timeCap = batch.maxConcurrentBatchesByTime.toString().padStart(6, ' ');
	const ramCap = batch.maxConcurrentBatchesByRam.toString().padStart(6, ' ');
	const deployed = ongoingBatches.size.toString().padStart(6, ' ');
	const timeToRamPercentValue = Math.min(batch.maxConcurrentBatchesByTime / batch.maxConcurrentBatchesByRam, 1)
	const timeToRamPercent = ns.formatPercent(timeToRamPercentValue, (timeToRamPercentValue < 0.1) ? 1 : 0).padStart(4, ' ');
	const ramToTimePercentValue = batch.getPercentOfBatchesAllowedByRam();
	const ramToTimePercent = ns.formatPercent(ramToTimePercentValue, (ramToTimePercentValue < 0.1) ? 1 : 0).padStart(4, ' ');
	const deployedPercent = ns.formatPercent(ongoingBatches.size / Math.min(batch.maxConcurrentBatchesByRam, batch.maxConcurrentBatchesByTime), 0, 10).padStart(4, ' ');
	const income = ('$' + formatMoney(batch.getIncomePerSecond(ns, true), 3) + '/s').padStart(15, ' ');
	const duration = formatTime(batch.batchTime, true).padStart(9, ' ');
	//Actual report
	ns.print('╔════════════════════════════╤════════╤═════════════════╗'); //55
	ns.print(`║ ${target} │ Spacer │ ${spacer} ║`);
	ns.print('╟─────────────────────┬──────┼────────┴─┬────────┬──────╢');
	ns.print(`║ Percent to hack     │ ${percentToHack} │ Time cap │ ${timeCap} │ ${timeToRamPercent} ║`);
	ns.print('╟─────────────────────┼──────┼──────────┼────────┼──────╢');
	ns.print(`║ Hack success chance │ ${hackChance} │ Ram  cap │ ${ramCap} │ ${ramToTimePercent} ║`);
	ns.print('╟────────────────┬────┴──────┼──────────┼────────┼──────╢');
	ns.print(`║ Batch ram cost │ ${batchRamCost} │ Deployed │ ${deployed} │ ${deployedPercent} ║`);
	ns.print('╟────────────────┼───────────┼────────┬─┴────────┴──────╢');
	ns.print(`║ Batch duration │ ${duration} │ Income │ ${income} ║`);
	ns.print('╚════════════════╧═══════════╧════════╧═════════════════╝'); //55
	//Resize tail
	ns.resizeTail(555, 16 * 13);
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
		this.hackRamCost = 1.70 * this.hackThreads;
		this.growRamCost = 1.75 * this.growThreads;
		this.weaken1RamCost = 1.75 * this.weaken1Threads;
		this.weaken2RamCost = 1.75 * this.weaken2Threads;
		this.batchRamCost = this.hackRamCost + this.growRamCost + this.weaken1RamCost + this.weaken2RamCost;
		//Concurrent batches
		this.maxConcurrentBatchesByRam = ramServers?.reduce((total, server) => total + Math.floor(ns.getServerMaxRam(server) / this.batchRamCost), 0) ?? 0;
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
		this.maxConcurrentBatchesByTime = Math.max(Math.floor(this.weakenTime / this.batchWindow), 1);
	}

	/** @param {NS} ns */
	getIncomePerSecond(ns, accountForRam = false) {
		const ramMultiplier = (accountForRam)
			? this.getPercentOfBatchesAllowedByRam()
			: 1;
		return this.primed.moneyMax
			* this.percentToHack
			* this.hackChance
			* (1000 / this.batchWindow)
			* ramMultiplier;
	}

	getPercentOfBatchesAllowedByRam() { return Math.min(this.maxConcurrentBatchesByRam / this.maxConcurrentBatchesByTime, 1); }
}
