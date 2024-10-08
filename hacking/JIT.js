import { formatTime, getServerList, compactTail } from 'utils.js';
import { upgradeHomeAndBuyPrograms } from 'upgrades/home.js';
import { spendHashesToMaxServer } from 'hacknet/hashnet.js'
import { applyToAllCompanies } from 'factions/join_companies.js';
import { expandServers } from 'upgrades/servers.js';
import { spread } from 'servers/infect_all.js';

/** @param {NS} ns */
export async function main(ns) {
	await batcherMainLoop(ns);
}

const DEBUG_MODE = false;
const HOME = 'home';
const SCRIPTS = ['hacking/hack.js', 'hacking/grow.js', 'hacking/weaken.js'];
const MIN_TIME_BETWEEN_BATCH_RECALCULATIONS = 300e3;
const MIN_CYCLES_BETWEEN_BATCH_RECALCULATIONS = 3; // Suggested >= 2
const EXTRA_DELAY_DECAY_SPEED = 12; // Keep below BATCH_SPACER + JOB_SPACER * 3
const GROW_THREADS_MULTIPLIER = 1.05; //Used to counter unexpected increases in hacking power
const BATCH_SPACER = 70; // Keep above JOB_SPACER and 5ms, preferably >= 20ms
const JOB_SPACER = 10; // Keep below BATCH_SPACER and above 4ms

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
export async function batcherMainLoop(ns) {
	//Make sure this is the only instance
	if (ns.getHostname() != HOME) throw new Error(`Batch manager must run only on home.`)
	if (portID != null) ns.kill(portID);

	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(1e3);
	ns.resizeTail(555, 16 * 13);
	ns.moveTail(2003, 1144);

	//Safety
	ns.atExit(() => reset(ns));

	//Top level variables setup
	portID = ns.pid;
	port = ns.getPortHandle(portID);
	updateServers(ns);
	batch = new HWGWBatch(ns, 'home', 0.01);

	while (true) {
		//Upgrade home
		upgradeHomeAndBuyPrograms(ns);
		//ns.exec('upgrades/home.js', 'home', 1, false);

		//Purchase servers
		expandServers(ns);

		//Nuke servers
		spread(ns);

		//TODO: Consider adding a run backdoor.js

		//This makes it easier to unlock corp factions
		applyToAllCompanies(ns);

		//Update servers
		updateServers(ns);

		//Update batch
		const oldTarget = batch.target;
		//batch = findOptimalBatch(ns);
		batch = getBestBatch(ns);
		//batch.forceUpdateAll(ns, 'foodnstuff', 0.01, 70, 10); //DEBUG option
		ns.print('INFO Updated batch parameters');
		ns.print(`INFO New target is ${batch.target} with ${ns.formatPercent(batch.percentToHack, 1)}`);

		//Improve target using hashes after having gained a few levels
		if (batch.player.skills.hacking > 100)
			spendHashesToMaxServer(ns, batch.target);

		//Prime security
		if (batch.target != oldTarget) {
			reset(ns); //Always called on startup (required)
			await primeTargetServer(ns, batch.target);
			batch.forceUpdateAll(ns, batch.target, batch.percentToHack, batch.batchSpacer);
			oldWeakenTime = batch.weakenTime;
			shotgunStartup(ns);
			if (DEBUG_MODE) ns.tprint(`After shotgun startup there are ${ongoingBatches.size} batches`);
		}

		//Report batch details
		report(ns);

		//Actual batcher
		await autobatchV4(ns);
	}
}

//---------------------------------------------------------------------------
//									<< RESET >>
//---------------------------------------------------------------------------
/** @param {NS} ns */
function reset(ns) {
	//ns.enableLog('ALL');
	try { killAllOngoingBatches(ns) }
	catch { ns.tprint('ERROR Failed to kill batches!') }
	port.clear();
	IDCounter = 0;
	extraDelay = 0;
	oldWeakenTime = 0;
	ongoingBatches.clear();
	//ns.disableLog('ALL');
	//ns.print('disableLog: Disabled logging for ALL');
}

/** @param {NS} ns */
function killAllOngoingBatches(ns) {
	if (ongoingBatches.size > 0) ns.print('WARN Killing batches, game might freeze!');
	for (const [key, pids] of ongoingBatches.entries()) {
		ns.kill(pids.hack);
		ns.kill(pids.weaken1);
		ns.kill(pids.grow);
		ns.kill(pids.weaken2);
		ongoingBatches.delete(key);
		port.read();
	}
}

//---------------------------------------------------------------------------
//								<< TARGETING >>
//---------------------------------------------------------------------------

/**
 * @param {NS} ns
 * @return {HWGWBatch}
 */
function getBestBatch(ns) {
	const startTime = performance.now();
	const bestServer = getBestBatchServer(ns);
	const bestPercent = getBestBatchPercent(ns, bestServer, 0.001);
	ns.print('INFO Target selection took ' + formatTime(performance.now() - startTime));
	return new HWGWBatch(ns, bestServer, bestPercent);
}

/**
 * @param {NS} ns
 * @param {string} serverName
 * @param {number} precision
 * @return {number}
 */
function getBestBatchPercent(ns, serverName, precision = 0.01) {
	if (precision > 0.5 || precision <= 0) 
		throw new RangeError(`Tried to find a target with a precision of ${precision.toFixed(3)}, it must be a positive number <= 0.5.`);
	
	const ramCapacities = ramServers
		.map(server => ns.getServerMaxRam(server))
		.sort((a, b) => b - a);
	const player = ns.getPlayer();
	const batch = new HWGWBatch(ns, serverName, 0.01);

	let bestPercent = 0;
	let bestPercentIncome = 0;

	for (let i = precision; i < 1; i += precision) {
		batch.updateThreadCounts(ns, i, 1, player);
		if (batch.maxConcurrentBatches <= 1) continue;
		const maxBatchesByRam = ramCapacities.reduce((total, serverRam) => Math.floor(serverRam / batch.batchRamCost) + total, 0);
		const newIncome = batch.getIncomePerSecond() * Math.min(maxBatchesByRam / batch.maxConcurrentBatches, 1);
		if (newIncome > bestPercentIncome) {
			bestPercentIncome = newIncome;
			bestPercent = i;
		}
	}

	return bestPercent;
}

/**
 * @param {NS} ns
 * @return {string}
 */
function getBestBatchServer(ns) {
	//NOTE: This is optimized using some approximations, there might be minor inaccuracies
	//NOTE: What matters is that it is equally wrong with every server
	//Thanks to @Shyguy and @d0sboots on discord
	const player = ns.getPlayer();

	let bestTarget = 'home';
	let bestScore = 0;

	for (const target of targetServers) {
		// Setup
		const targetServer = ns.getServer(target);
		const targetSecurity = targetServer.hackDifficulty;
		targetServer.hackDifficulty = targetServer.minDifficulty;
		// Grow
		const growthPercent = ns.formulas.hacking.growPercent(targetServer, 1, player, 1);
		// Hack
		const hackPercent = ns.formulas.hacking.hackPercent(targetServer, player);
		const hackThreadsFractional = growthPercent / hackPercent;
		const hackChance = ns.formulas.hacking.hackChance(targetServer, player);
		const moneyStolen = hackThreadsFractional * hackPercent * targetServer.moneyMax * hackChance;
		// Weaken
		const difficultyIncrease = 0.004 + hackThreadsFractional * 0.002;
		const weakenThreadsFactional = difficultyIncrease / 0.05; //Hack: +0.004; Grow: +0.002; Weaken: -0.05;
		const totalThreads = 1 + hackThreadsFractional + weakenThreadsFactional;
		const weakenDuration = ns.formulas.hacking.weakenTime(targetServer, player);
		// Non primed server penalty
		let penaltyMult = 1;
		if (targetSecurity > targetServer.minDifficulty) penaltyMult -= 0.1;
		if (targetServer.moneyAvailable < targetServer.moneyMax) penaltyMult -= 0.1;
		if (penaltyMult === 0.8) penaltyMult = 0.75;
		// Comparison
		const score = (moneyStolen / totalThreads / weakenDuration) * penaltyMult;
		if (score >= bestScore) {
			bestScore = score;
			bestTarget = target;
		}
	}

	return bestTarget;
}


//---------------------------------------------------------------------------
//								<< PRIMER >>
//---------------------------------------------------------------------------
/**
 * @param {NS} ns
 * @param {string} target
 */
async function primeTargetServer(ns, target) {
	// Weaken
	let server = ns.getServer(target);
	let weakenThreadsRequired = Math.ceil((server.hackDifficulty - server.minDifficulty) / ns.weakenAnalyze(1));
	if (weakenThreadsRequired > 0) {
		ns.print(`Need ${weakenThreadsRequired} weaken threads`);
		for (let i = 1; weakenThreadsRequired > 0; i++) {
			ns.print(`Starting weakening cycle ${i} which will take ${formatTime(ns.getWeakenTime(target))}`);
			for (const server of ramServers) {
				const threadsServerCanFit = Math.floor((ns.getServerMaxRam(server) - ns.getServerUsedRam(server)) / 1.75);
				if (threadsServerCanFit === 0) continue;
				ns.scp(SCRIPTS, server, HOME);
				ns.exec('hacking/weaken.js', server, Math.min(threadsServerCanFit, weakenThreadsRequired), target);
				weakenThreadsRequired -= threadsServerCanFit;
				if (weakenThreadsRequired <= 0) break;
			}
			if (weakenThreadsRequired > 0) ns.print(`Stll missing ${weakenThreadsRequired} weaken threads`);
			await ns.sleep(ns.getWeakenTime(target) + 1e3);
		}
	}
	else 
		ns.print('Target is already at minimum security');
	
	// Grow
	server.hackDifficulty = server.minDifficulty;
	let growThreadsRequired = ns.formulas.hacking.growThreads(server, ns.getPlayer(), server.moneyMax);
	if (growThreadsRequired > 0) {
		ns.print(`Need ${growThreadsRequired} grow threads`);
		for (let i = 1; server.moneyAvailable < server.moneyMax; i++) {
			ns.print(`Starting growing cycle ${i} which will take ${formatTime(ns.getWeakenTime(target))}`);

			growThreadsRequired = Math.floor(ns.formulas.hacking.growThreads(server, ns.getPlayer(), server.moneyMax) * GROW_THREADS_MULTIPLIER);
			
			for (const server of ramServers) {
				const serverThreadCapacity = Math.floor((ns.getServerMaxRam(server) - ns.getServerUsedRam(server)) / 1.75);
				if (serverThreadCapacity < 2) continue;
				ns.scp(SCRIPTS, server, HOME);
				weakenThreadsRequired = Math.ceil(growThreadsRequired / 12.5);
				
				if (serverThreadCapacity >= growThreadsRequired + weakenThreadsRequired) {
					//Everything remaining can fit in one server
					ns.exec('hacking/weaken.js', server, weakenThreadsRequired, target);
					ns.exec('hacking/grow.js', server, growThreadsRequired, target);
					growThreadsRequired = 0;
					break;
				}
				else {
					//Need to split over multiple servers
					const serverWeakenThreads = Math.ceil(serverThreadCapacity / 13.5);
					const serverGrowThreads = serverThreadCapacity - serverWeakenThreads;
					ns.exec('hacking/weaken.js', server, serverWeakenThreads, target);
					ns.exec('hacking/grow.js', server, serverGrowThreads, target);
					growThreadsRequired -= serverGrowThreads;
					weakenThreadsRequired -= serverWeakenThreads;
				}
				if (growThreadsRequired <= 0) break;
			}

			if (growThreadsRequired > 0) ns.print(`Stll missing ${growThreadsRequired} grow threads`);
			await ns.sleep(ns.getWeakenTime(target) + 1e3);
			server = ns.getServer(server.hostname);
		}
	}
	else 
		ns.print('Target is already at maximum money');
}

//---------------------------------------------------------------------------
//								<< SHOTGUN >>
//---------------------------------------------------------------------------
/** @param {NS} ns */
function shotgunStartup(ns) {
	shotgunDeploy(ns, batch.maxConcurrentBatches)
	//Relay info
	ns.print(`INFO Deployed ${ongoingBatches.size} of ${batch.maxConcurrentBatches} batches. (${ns.formatPercent(ongoingBatches.size / batch.maxConcurrentBatches, 1)})`);
}

/**
 * @param {NS} ns
 * @param {number} amount
 * @return {number} Batches deployed
 */
function shotgunDeploy(ns, amount = 1) {
	const originalExtraDelay = extraDelay;
	const player = ns.getPlayer();
	let batchesDeployed = 0;
	for (const server of ramServers) {
		const serverData = ns.getServer(server);
		batch.updateThreadCounts(ns, batch.percentToHack, serverData.cpuCores, player);
		let freeRam = serverData.maxRam - serverData.ramUsed;
		while (freeRam >= batch.batchRamCost && batchesDeployed < amount && batchesDeployed < batch.maxConcurrentBatches) {
			deployBatch(ns, server, false);
			extraDelay += batch.batchWindow; // Recycles extraDelay parameter to stagger scripts
			freeRam -= batch.batchRamCost;
			batchesDeployed++;
		}
		if (freeRam >= batch.batchRamCost) break; // We left the while() for a reason different than remaining ram
	}
	extraDelay = originalExtraDelay;
	return batchesDeployed;
}

/** 
 * @param {NS} ns 
 * @param {string} host
 * @param {boolean} decayExtraDelay
 */
function deployBatch(ns, host, decayExtraDelay = true) {
	const pids = {};

	pids.hack = ns.exec('hacking/hack.js', host, batch.hackThreads, batch.target, batch.hackDelay + extraDelay, false, IDCounter);
	pids.weaken1 = ns.exec('hacking/weaken.js', host, batch.weaken1Threads, batch.target, batch.weaken1Delay + extraDelay, false, 0, IDCounter);
	pids.grow = ns.exec('hacking/grow.js', host, batch.growThreads, batch.target, batch.growDelay + extraDelay, false, IDCounter);
	pids.weaken2 = ns.exec('hacking/weaken.js', host, batch.weaken2Threads, batch.target, batch.weaken2Delay + extraDelay, false, portID, IDCounter);

	if (pids.hack === 0 || pids.weaken1 === 0 || pids.grow === 0 || pids.weaken2 === 0) {
		const message = `ERROR Failed to launch batch n. ${IDCounter}`; //Must save IDCounter before reset(ns)
		//reset(ns);
		throw new Error(message);
	}
	pids.startTime = performance.now();
	pids.host = host;
	ongoingBatches.set(IDCounter++, pids);
	if (extraDelay > 0 && decayExtraDelay) extraDelay -= Math.min(EXTRA_DELAY_DECAY_SPEED, extraDelay); //Min is to not go negative
}

//---------------------------------------------------------------------------
//						<< POST INITIALIZATION BATCHING >>
//---------------------------------------------------------------------------
/** @param {NS} ns */
async function autobatchV4(ns) {
	// Start a timer
	let timerStillRunning = true;
	const timeTimeout = Math.ceil(MIN_TIME_BETWEEN_BATCH_RECALCULATIONS / batch.batchTime) * batch.batchTime;
	const cycleTimeout = MIN_CYCLES_BETWEEN_BATCH_RECALCULATIONS * batch.batchTime;
	const timerDuration = Math.max(timeTimeout, cycleTimeout);
	setTimeout(() => timerStillRunning = false, timerDuration);
	while (timerStillRunning) {
		//Force reset in startup failed, usually from reloading the save
		if (ongoingBatches.size === 0) {
			ns.print('ERROR Ongoing batches became 0, restarting script');
			await ns.sleep(3e3)
			ns.closeTail()
			ns.spawn(ns.getScriptName(), {threads: 1, spawnDelay: 2e3}, ...ns.args);
		}
		//Wait until there is room
		await port.nextWrite();
		//Remove finished batches from log
		let concludedID = port.read();
		ongoingBatches.delete(concludedID);
		//This should not happen anymore, keeping just in case
		while (!port.empty()) {
			if (DEBUG_MODE) ns.tprint('ERROR Port should be empty but it\'s not!');
			concludedID = port.read();
			ongoingBatches.delete(concludedID);
		}
		//Recalculate threads and add extra delay if stats improved
		compensateWeakenTimeChanges(ns);
		//HASHNET Compensations
		//If money < max kill next hack and weaken1
		if (ns.getServerMoneyAvailable(batch.target) < batch.primed.moneyMax) {
			if (DEBUG_MODE) ns.tprint(`WARN Target money is below maximum, killing next hack and weaken1`);
			killNextOngoing(ns, true, true, false, false);
		}
		//If security > min kill next hack and grow
		if (ns.getServerSecurityLevel(batch.target) > batch.primed.minDifficulty) {
			if (DEBUG_MODE) ns.tprint(`WARN Current security ${ns.getServerSecurityLevel(batch.target)} / ${batch.primed.minDifficulty}`);
			if (DEBUG_MODE) ns.tprint(`WARN Target security is above minimum, killing next hack and grow`);
			killNextOngoing(ns, true, false, true, false);
			if (DEBUG_MODE) ns.tprint(`WARN Target security is above minimum, skipping deployment to avoid collisions`);
			extraDelay -= batch.batchWindow - EXTRA_DELAY_DECAY_SPEED;
			if (extraDelay < 0) extraDelay = 0;
			report(ns);
			continue;
		}
		//Avoid creating too many batches
		if (ongoingBatches.size >= batch.maxConcurrentBatches) {
			if (DEBUG_MODE) ns.tprint(`WARN Skipping ${IDCounter++} because we overdeployed`);
			extraDelay -= batch.batchWindow - EXTRA_DELAY_DECAY_SPEED;
			if (extraDelay < 0) extraDelay = 0;
			continue;
		}
		//Deploy new batch
		if (DEBUG_MODE) ns.tprint(`INFO Deploying batch ${IDCounter}`);

		const player = ns.getPlayer();
		let deployed = false;
		for (const server of ramServers) {
			const serverData = ns.getServer(server);
			batch.updateThreadCounts(ns, batch.percentToHack, serverData.cpuCores, player);
			while (ongoingBatches.size < batch.maxConcurrentBatches && serverData.maxRam - serverData.ramUsed >= batch.batchRamCost) {
				if (deployed) extraDelay += batch.batchWindow; // Avoid future collisions
				deployBatch(ns, server, true);
				deployed = true;
				serverData.ramUsed += batch.batchRamCost;
			}
			if (ongoingBatches.size >= batch.maxConcurrentBatches) break;
		}

		if (DEBUG_MODE) ns.tprint(`INFO Last batch deployed : ${IDCounter - 1}`);
		if (DEBUG_MODE) ns.tprint(`DEBUG Currently deployed batches: ${ongoingBatches.size} / ${batch.maxConcurrentBatches}`);
		
		//Report changes
		report(ns);
	}
}

/** 
 * @param {NS} ns
 * @param {boolean} hack
 * @param {boolean} weaken1
 * @param {boolean} grow
 * @param {boolean} weaken2
 * @return {boolean} true if killing the scripts was successful, false otherwise
 */
function killNextOngoing(ns, hack = false, weaken1 = false, grow = false, weaken2 = false) {
	let entry = ongoingBatches.entries().next();
	let [id, pids] = [0, undefined];
	let success = true;

	if (entry.done) {
		if (DEBUG_MODE) ns.tprint('ERROR Ran out of scripts to kill');
		throw new Error('Tried to kill the next ongoing hack/grow but there were no batches left');
		return false;
	}

	[id, pids] = entry.value;
	
	if (DEBUG_MODE) {
		let message  = 'WARN Trying to kill ';
		if (hack) message.concat('hack');
		if (weaken1) message.concat(' | weaken1');
		if (grow) message.concat(' | grow');
		if (weaken2) message.concat(' | weaken2');
		ns.tprint(message);
		ns.tprint(`Scripts running ${ns.isRunning(pids.hack)} | ${ns.isRunning(pids.weaken1)} | ${ns.isRunning(pids.grow)} | ${ns.isRunning(pids.weaken2)}`);
	}
	
	if (hack) 
		success = success && ns.kill(pids.hack);
	if (weaken1) 
		success = success && ns.kill(pids.weaken1);
	if (grow) 
		success = success && ns.kill(pids.grow);
	if (weaken2) 
		success = success && ns.kill(pids.weaken2);
	if (!success) {
		if (DEBUG_MODE) ns.tprint(`ERROR Failed to kill pids ${id} on ${pids.host}`);
		if (DEBUG_MODE) ns.tprint(`ERROR PIDS were ${pids.hack} | ${pids.weaken1} | ${pids.grow} | ${pids.weaken2}`);
		//throw new Error('Failed to kill an ongoing hack/grow');
	}
	return success;
}

/** @param {NS} ns */
function updateServers(ns) {
	allServers = getServerList(ns, false);
	ramServers = allServers.filter(server => ns.getServerMaxRam(server) > 0 && ns.hasRootAccess(server) && ns.scp(SCRIPTS, server, 'home') !== undefined);
	ramServers.sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));
	ramServers.push('home'); //Adding home after the sort makes sure it's only used as a last resort
	const hackingLevel = ns.getPlayer().skills.hacking;
	targetServers = allServers.filter(server => 
		ns.getServerRequiredHackingLevel(server) <= hackingLevel && 
		ns.getServerMaxMoney(server) > 0 &&
		ns.hasRootAccess(server)
	);
}

//---------------------------------------------------------------------------
//							<< MID-RUN RECALCULATIONS >>
//---------------------------------------------------------------------------
/** @param {NS} ns */
function compensateWeakenTimeChanges(ns) {
	const newWeakenTime = ns.getWeakenTime(batch.target);
	if (newWeakenTime >= oldWeakenTime) return;
	//Lower weaken time means stat upgrades
	batch.forceUpdateAll(ns, batch.target, batch.percentToHack, batch.batchSpacer);
	//Add extra delay to avoid future collisions
	extraDelay += Math.ceil(oldWeakenTime - newWeakenTime);
	oldWeakenTime = newWeakenTime;
	report(ns);
}

//---------------------------------------------------------------------------
//								<< GRAPHICS >>
//---------------------------------------------------------------------------
/** @param {NS} ns */
function report(ns) {
	//╔═╗╚╝║╠╣╟╢╤╧╪─│┬┴┼▲▼■□
	//Possible width 9.735 * characters
	//Calculations
	const target = batch.target.toUpperCase().padStart((26 - batch.target.length) / 2 + batch.target.length, ' ').padEnd(26, ' '); //Centered version
	const percentToHack = ns.formatPercent(batch.percentToHack, 1).padStart(6, ' ');
	const hackChance = ns.formatPercent(batch.hackChance, 0).padStart(4, ' ');
	const batchRamCost = ns.formatRam(batch.batchRamCost, 0).padStart(6, ' ') + '/ea';
	const duration = formatTime(batch.batchTime + extraDelay, true).padStart(9, ' ');
	const formattedExtraDelay = (`${extraDelay}ms`).padStart(10, ' ');
	const hackThreads = batch.hackThreads.toString().padStart(6, ' ');
	const weaken1Threads = batch.weaken1Threads.toString().padStart(6, ' ');
	const growThreads = batch.growThreads.toString().padStart(6, ' ');
	const weaken2Threads = batch.weaken2Threads.toString().padStart(6, ' ');
	const deployed = ongoingBatches.size.toString().padStart(5, ' ')
	const deployedPercent = Math.min(ongoingBatches.size / batch.maxConcurrentBatches, 1)
	const formattedPercent = ns.formatPercent(deployedPercent, (deployedPercent < 0.9995) ? 1 : 0).padStart(5, ' ')
	const timeTimeout = Math.ceil(MIN_TIME_BETWEEN_BATCH_RECALCULATIONS / batch.batchTime) * batch.batchTime;
	const cycleTimeout = MIN_CYCLES_BETWEEN_BATCH_RECALCULATIONS * batch.batchTime;
	const timerDuration = Math.max(timeTimeout, cycleTimeout);
	const actualIncome = batch.getIncomePerSecond() * deployedPercent * (timerDuration - batch.hackDelay) / timerDuration
	const income = ('$' + ns.formatNumber(actualIncome, 3) + '/s').padStart(15, ' ');
	//Actual report
	ns.print('╔════════════════════════════╤═════════════╤════════════╗'); //55
	ns.print(`║ ${target} │ Extra Delay │ ${formattedExtraDelay} ║`);
	ns.print('╟─────────────────────┬──────┼───┬────────┬┴───┬────────╢');
	ns.print(`║ Hack success chance │ ${hackChance} │ H │ ${hackThreads} │ W1 │ ${weaken1Threads} ║`);
	ns.print('╟───────────────────┬─┴──────┼───┼────────┼────┼────────╢');
	ns.print(`║ Percent to hack   │ ${percentToHack} │ G │ ${growThreads} │ W2 │ ${weaken2Threads} ║`);
	ns.print('╟────────────────┬──┴────────┼───┴──────┬─┴────┴┬───────╢');
	ns.print(`║ Batch ram cost │ ${batchRamCost} │ Deployed │ ${deployed} │ ${formattedPercent} ║`);
	ns.print('╟────────────────┼───────────┼────────┬─┴───────┴───────╢');
	ns.print(`║ Batch duration │ ${duration} │ Income │ ${income} ║`);
	ns.print('╚════════════════╧═══════════╧════════╧═════════════════╝'); //55
	//Resize tail
	ns.resizeTail(555, 16 * 13);
	ns.getPlayer(); //This is used only to buy clock time
	compactTail(ns.getScriptName());
}


//---------------------------------------------------------------------------
//						<<HWGW BATCH DETAILS>>
//---------------------------------------------------------------------------
class HWGWBatch {
	/** 
	 * @param {NS} ns
	 * @param {string} target
	 * @param {number} percentToHack
	 * @param {number} batchSpacer
	 */
	constructor(ns, target, percentToHack = 0.01, batchSpacer = BATCH_SPACER, jobSpacer = JOB_SPACER) {
		this.forceUpdateAll(ns, target, percentToHack, batchSpacer, jobSpacer);
	}

	/** 
	 * @param {NS} ns
	 * @param {string} target
	 * @param {number} percentToHack
	 * @param {number} batchSpacer
	 */
	forceUpdateAll(ns, target, percentToHack = 0.01, batchSpacer = BATCH_SPACER, jobSpacer = JOB_SPACER) {
		if (batchSpacer < jobSpacer)
			throw new RangeError(`Provided ${batchSpacer} as the batch spacer, it should be >= ${jobSpacer}.`);
		this.batchSpacer = batchSpacer;
		this.jobSpacer = jobSpacer;
		this.batchWindow = batchSpacer + jobSpacer * 3;
		this.changeTarget(ns, target);
		this.updateThreadCounts(ns, percentToHack);
		this.updateTimings(ns);
	}

	/** 
	 * @param {NS} ns
	 * @param {string} target
	 * @param {number} percentToHack
	 * @param {number} batchSpacer
	 */
	updateAll(ns, target, percentToHack = 0.01, batchSpacer = 70, jobSpacer = 10) {
		if (batchSpacer < jobSpacer)
			throw new RangeError(`Provided ${batchSpacer} as the batch spacer, it should be >= ${jobSpacer}.`);
		if (this.target !== target) {
			this.changeTarget(ns, target);
		}
		if (this.percentToHack !== percentToHack || this.target !== target) {
			this.updateThreadCounts(ns, percentToHack);
		}
		if (this.target !== target || this.batchSpacer !== batchSpacer || this.jobSpacer !== jobSpacer) {
			this.batchSpacer = batchSpacer;
			this.jobSpacer = jobSpacer;
			this.batchWindow = batchSpacer + jobSpacer * 3;
			this.updateTimings(ns);
		}
	}

	/** 
	 * @param {NS} ns
	 * @param {string} target
	 */
	changeTarget(ns, target) {
		this.target = target;
		this.primed = ns.getServer(target);
		this.primed.moneyAvailable = this.primed.moneyMax;
		this.primed.hackDifficulty = this.primed.minDifficulty;
	}

	/** 
	 * @param {NS} ns
	 * @param {number} percentToHack
	 * @param {number} coreCount
	 * @param {Player} player
	 */
	updateThreadCounts(ns, percentToHack = 0.01, coreCount = 1, player = ns.getPlayer()) {
		if (percentToHack <= 0 || percentToHack >= 1)
			throw new RangeError(`Provided ${percentToHack} as percentage to hack, it should be included between 0 and 1 (excluded).`);
		this.percentToHack = percentToHack;
		this.player = player;
		//Hack
		this.hackChance = ns.formulas.hacking.hackChance(this.primed, this.player);
		this.hackPower = ns.formulas.hacking.hackPercent(this.primed, this.player);
		this.hackThreads = Math.max(Math.floor(this.percentToHack / this.hackPower), 1);
		//Weaken 1
		this.weakenPower = ns.weakenAnalyze(1, coreCount);
		this.weaken1Threads = Math.ceil((this.hackThreads * 0.002) / this.weakenPower);
		//Grow
		this.primed.moneyAvailable = Math.max(this.primed.moneyMax * (1 - this.hackPower * this.hackThreads), 0);
		this.growThreads = ns.formulas.hacking.growThreads(this.primed, this.player, this.primed.moneyMax, coreCount);
		this.growThreads = Math.ceil(this.growThreads * GROW_THREADS_MULTIPLIER);
		this.primed.moneyAvailable = this.primed.moneyMax;
		//Weaken 2
		this.weaken2Threads = Math.ceil((this.growThreads * 0.004) / this.weakenPower) + 1;
		//Ram cost
		this.hackRamCost = 1.70 * this.hackThreads;
		this.growRamCost = 1.75 * this.growThreads;
		this.weaken1RamCost = 1.75 * this.weaken1Threads;
		this.weaken2RamCost = 1.75 * this.weaken2Threads;
		this.batchRamCost = this.hackRamCost + this.growRamCost + this.weaken1RamCost + this.weaken2RamCost;
	}

	/** @param {NS} ns */
	updateTimings(ns) {
		//Job durations
		this.hackTime = ns.formulas.hacking.hackTime(this.primed, this.player);
		this.growTime = this.hackTime * 3.2; // 16/5
		this.weakenTime = Math.max(this.hackTime * 4, this.batchWindow); //TODO: Test whether batchWindow is enough/too much
		this.batchTime = this.weakenTime + this.jobSpacer * 2;
		//Job delays
		this.hackDelay = Math.max(this.weakenTime - this.hackTime - this.jobSpacer, 0);
		this.weaken1Delay = 0;
		this.growDelay = this.weakenTime - this.growTime + this.jobSpacer;
		this.weaken2Delay = this.jobSpacer * 2;
		//Concurrent batches
		this.maxConcurrentBatches = Math.max(Math.floor(this.weakenTime / this.batchWindow), 1);
	}

	/** @return {number} */
	getIncomePerSecond() {
		return this.primed.moneyMax
			* this.percentToHack
			* this.hackChance
			* (1000 / this.batchWindow);
	}
}