import { formatTime, getServerList, compactTail } from 'utils.js';
import { upgradeHomeAndBuyPrograms } from 'upgrades/home.js';
import { spendHashesToMaxServer } from 'hacknet/hashnet.js';
import { applyToAllCompanies } from 'factions/join_companies.js';
import { expandServers } from 'upgrades/servers.js';
import { spread } from 'servers/infect_all.js';

/** @param {NS} ns */
export async function main(ns) {
	let [spacer = 20] = ns.args;
	await batcherMainLoop(ns, spacer);
}

const DEBUG_MODE = false;
const THIS_SCRIPT_NAME = 'hacking/shotgun_v4.js';
const HOME = 'home';
const SCRIPTS = ['hacking/hack.js', 'hacking/grow.js', 'hacking/weaken.js'];
const SCRIPT_COST = 1.75;
const MAX_BATCHES_PER_CYCLE = 3000;
const GROW_THREADS_MULTIPLIER = 1.05; //Used to counter increases in hacking power
const MIN_RAM_RATIO = 0.7

let batchesDeployed = 0;
let predictedLevel = 0;

/** @type {string[]} */
let allServers;
/** @type {string[]} */
let ramServers;
/** @type {string[]} */
let targetServers;
/** @type {HWGWBatch} */
let batch;

/** @param {NS} ns */
export async function batcherMainLoop(ns, spacer) {
	//Make sure this is the only instance
	if (ns.getHostname() != HOME) throw new Error(`Batch manager must run only on home.`)

	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(0);
	//ns.moveTail(2022, 485);
	ns.resizeTail(536, 16 * 13);
	ns.moveTail(1957, 484);

	//Top level variables setup
	updateServers(ns);
	batch = new HWGWBatch(ns, 'home', 0.01, spacer);

	while (true) {
		//Upgrade home
		//upgradeHomeAndBuyPrograms(ns);
		ns.exec('upgrades/home.js', 'home', 1, false);
		await ns.sleep(20);

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
		batch = findOptimalBatch(ns, spacer);
		ns.print('INFO Updated batch parameters');
		ns.print(`INFO New target is ${batch.target}`);

		//Improve target using hashes after having gained a few levels
		if (batch.player.skills.hacking > 100)
			spendHashesToMaxServer(ns, batch.target);

		//Prime server
		if (batch.target != oldTarget) {
			await primeTargetServer(ns, batch.target);
			batch.forceUpdateAll(ns, batch.target, batch.percentToHack, batch.batchSpacer);
		}

		//Actual batcher
		batchesDeployed = shotgunV4(ns, MAX_BATCHES_PER_CYCLE);
		report(ns);
		await ns.sleep(batch.weakenTime + batch.batchWindow * batchesDeployed + 1e3);
	}
}

//---------------------------------------------------------------------------
//								<< TARGETING >>
//---------------------------------------------------------------------------
/**
 * @param {NS} ns
 * @param {number} spacer
 * @return {HWGWBatch}
 */
function findOptimalBatch(ns, spacer) {
	const startTime = performance.now();
	const ramCapacities = ramServers.map(server => ns.getServerMaxRam(server));
	ramCapacities.sort((a, b) => b - a);
	const batch = new HWGWBatch(ns, 'home', 0.01, spacer);
	targetServers.sort((a, b) => ns.getServerMaxMoney(b) - ns.getServerMaxMoney(a)); //TODO: Could filter if hack required is too high/low
	//targetServers.reverse(); //DELETE THIS
	//Iterate servers
	let bestTarget = 'home';
	let bestTargetPercent = 0;
	let bestTargetIncome = 0;
	let bestTargetRatio = 0;
	for (const target of targetServers) {
		//Iterate percent
		let bestPercent = 0;
		let bestPercentRatio = 0;
		let bestPercentIncome = 0;
		batch.forceUpdateAll(ns, target, 0.01, spacer);
		for (let i = 0.01; i < 1; i += 0.01) {
			batch.updateAll(ns, target, i, spacer);
			if (batch.maxConcurrentBatches <= 1) continue; //TODO: Properly fix underlying problem and remove
			if (batch.batchRamCost > ramCapacities[0]) continue;
			const maxBatchesByRam = ramCapacities
				.map(serverRam => Math.floor(serverRam / batch.batchRamCost))
				.reduce((total, serverBatches) => serverBatches + total);
			const ramRatio = Math.min(maxBatchesByRam / batch.maxConcurrentBatches, 1);
			const newIncome = batch.getIncomePerSecond() * ramRatio;
			//ns.print(`DEBUG ${target} @ ${i} \nBatch ram cost ${ns.formatRam(batch.batchRamCost, 1)}\tMax by ram ${maxBatchesByRam} \nMax concurrent ${batch.maxConcurrentBatches} \nRatio ${ramRatio}`)
			if (newIncome > bestPercentIncome && (ramRatio >= MIN_RAM_RATIO || ramRatio > bestPercentRatio)) {
				bestPercentIncome = newIncome;
				bestPercentRatio = ramRatio;
				bestPercent = i;
			}
		}
		//ns.print(`DEBUG Server ${target} Best percent ${bestPercent} Best income ${bestPercentIncome}`);
		if (bestPercentIncome > bestTargetIncome && (bestPercentRatio >= MIN_RAM_RATIO || bestPercentRatio > bestTargetRatio)) {
			bestTargetPercent = bestPercent
			bestTargetIncome = bestPercentIncome
			bestTargetRatio = bestPercentRatio
			bestTarget = target
		}
	}
	if (bestTarget === 'home' || batch.maxConcurrentBatches < 2) {
		ns.print('ERROR No valid target found!');
		ns.print('ERROR Switching to v1 mode is no longer supported!');
		ns.print('WARN Using 1% Noodles as fallback.')
		bestTarget = 'n00dles'
		bestTargetPercent = 0.01
	}
	batch.forceUpdateAll(ns, bestTarget, bestTargetPercent, spacer);
	ns.print('INFO Target selection took ' + formatTime(performance.now() - startTime));
	return batch;
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
				const threadsServerCanFit = Math.floor((ns.getServerMaxRam(server) - ns.getServerUsedRam(server)) / SCRIPT_COST);
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

			growThreadsRequired = ns.formulas.hacking.growThreads(server, ns.getPlayer(), server.moneyMax);
			
			for (const server of ramServers) {
				const serverThreadCapacity = Math.floor((ns.getServerMaxRam(server) - ns.getServerUsedRam(server)) / SCRIPT_COST);
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
/**
 * @param {NS} ns
 * @param {number} amount
 * @return {number} 
 */
function shotgunV4(ns, amount = 1) {
	const player = ns.getPlayer()
	const server = ns.getServer(batch.target)
	const nodeMultipliers = ns.getBitNodeMultipliers()
	let batchesDeployed = 0;
	let serverAvailableRam = 0;
	for (const host of ramServers) {
		//Check if the server can hold any batches
		serverAvailableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
		if (serverAvailableRam < batch.batchRamCost) continue;
		//Deploy batches on this server
		while (serverAvailableRam >= batch.batchRamCost && batchesDeployed < amount) {
			//Deploy batch
			deployBatch(ns, host, batch.batchWindow * batchesDeployed);
			batchesDeployed++;
			serverAvailableRam -= batch.batchRamCost;
			//Calculate xp gained
			const xpThreadMultiplier = batch.hackThreads * Math.min(batch.hackChance * 1.25, 1) + batch.weaken1Threads + batch.growThreads + batch.weaken2Threads;
			const xpGained = ns.formulas.hacking.hackExp(server, player) * xpThreadMultiplier * player.mults.hacking_exp * nodeMultipliers.HackExpGain;
			player.exp.hacking += xpGained;
			player.skills.hacking = ns.formulas.skills.calculateSkill(player.exp.hacking, player.mults.hacking * nodeMultipliers.HackingLevelMultiplier);
			if (DEBUG_MODE) {
				ns.tprint(`Batch n.${batchesDeployed}`);
				ns.tprint(`\tThread XP Multiplier : ${xpThreadMultiplier}`);
				ns.tprint(`\tPredicted XP Gain : ${ns.formatNumber(xpGained, 1)}`);
				ns.tprint(`\tPredicted total XP and level : ${ns.formatNumber(player.exp.hacking, 1)} | ${player.skills.hacking}`);
			}
			//Compensate level ups
			batch.updateThreadCounts(ns, batch.percentToHack, player);
		}
	}
	predictedLevel = player.skills.hacking;
	return batchesDeployed;
}

/** 
 * @param {NS} ns 
 * @param {string} host
 * @param {number} decayExtraDelay
 */
function deployBatch(ns, host, extraDelay = 0) {
	const pids = {};

	pids.hack = ns.exec('hacking/hack.js', host, batch.hackThreads, batch.target, batch.hackDelay + extraDelay);
	pids.weaken1 = ns.exec('hacking/weaken.js', host, batch.weaken1Threads, batch.target, batch.weaken1Delay + extraDelay);
	pids.grow = ns.exec('hacking/grow.js', host, batch.growThreads, batch.target, batch.growDelay + extraDelay);
	pids.weaken2 = ns.exec('hacking/weaken.js', host, batch.weaken2Threads, batch.target, batch.weaken2Delay + extraDelay);

	if (pids.hack === 0 || pids.weaken1 === 0 || pids.grow === 0 || pids.weaken2 === 0) {
		const message = `ERROR Failed to launch batch n. ${IDCounter}`; //Must save IDCounter before reset(ns)
		//reset(ns);
		throw new Error(message);
	}
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

//---------------------------------------------------------------------------
//								<< GRAPHICS >>
//---------------------------------------------------------------------------
/** @param {NS} ns */
function report(ns) {
	//╔═╗╚╝║╠╣╟╢╤╧╪─│┬┴┼▲▼■□
	//Possible width 9.735 * characters
	//Calculations
	const target = batch.target.toUpperCase().padStart((26 - batch.target.length) / 2 + batch.target.length, ' ').padEnd(26, ' '); //Centered version
	const percentToHack = ns.formatPercent(batch.percentToHack, 0).padStart(4, ' ');
	const hackChance = ns.formatPercent(batch.hackChance, 0).padStart(4, ' ');
	const batchRamCost = ns.formatRam(batch.batchRamCost, 0).padStart(6, ' ') + '/ea';
	const duration = formatTime(batch.batchTime, true).padStart(9, ' ');
	const formattedSpacers = (`${batch.jobSpacer} / ${batch.batchSpacer} / ${batch.batchWindow}`).padStart(15, ' ');
	const hackThreads = batch.hackThreads.toString().padStart(6, ' ');
	const weaken1Threads = batch.weaken1Threads.toString().padStart(6, ' ');
	const growThreads = batch.growThreads.toString().padStart(6, ' ');
	const weaken2Threads = batch.weaken2Threads.toString().padStart(6, ' ');
	const deployedOverTimeCap = `${batchesDeployed} / ${MAX_BATCHES_PER_CYCLE}`.padStart(13, ' ');
	const activeBatchingTime = batch.batchWindow * batchesDeployed
	const actualIncome = batch.getIncomePerSecond() * (activeBatchingTime / (activeBatchingTime + batch.hackDelay))
	const income = ('$' + ns.formatNumber(actualIncome, 3) + '/s').padStart(15, ' ');
	//Actual report
	ns.print('╔════════════════════════════╤════════╤═════════════════╗'); //55
	ns.print(`║ ${target} │ Spacer │ ${formattedSpacers} ║`);
	ns.print('╟─────────────────────┬──────┼───┬────┴───┬────┬────────╢');
	ns.print(`║ Percent to hack     │ ${percentToHack} │ H │ ${hackThreads} │ W1 │ ${weaken1Threads} ║`);
	ns.print('╟─────────────────────┼──────┼───┼────────┼────┼────────╢');
	ns.print(`║ Hack success chance │ ${hackChance} │ G │ ${growThreads} │ W2 │ ${weaken2Threads} ║`);
	ns.print('╟────────────────┬────┴──────┼───┴──────┬─┴────┴────────╢');
	ns.print(`║ Batch ram cost │ ${batchRamCost} │ Deployed │ ${deployedOverTimeCap} ║`);
	ns.print('╟────────────────┼───────────┼────────┬─┴───────────────╢');
	ns.print(`║ Batch duration │ ${duration} │ Income │ ${income} ║`);
	ns.print('╚════════════════╧═══════════╧════════╧═════════════════╝'); //55
	//Resize tail
	ns.resizeTail(555, 16 * 13);
	ns.getPlayer(); //This is used only to buy clock time
	compactTail(THIS_SCRIPT_NAME);
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
	constructor(ns, target, percentToHack = 0.01, batchSpacer = 70, jobSpacer = 10) {
		this.forceUpdateAll(ns, target, percentToHack, batchSpacer, jobSpacer);
	}

	/** 
	 * @param {NS} ns
	 * @param {string} target
	 * @param {number} percentToHack
	 * @param {number} batchSpacer
	 */
	forceUpdateAll(ns, target, percentToHack = 0.01, batchSpacer = 70, jobSpacer = 10) {
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
	 */
	updateThreadCounts(ns, percentToHack, player = ns.getPlayer()) {
		if (percentToHack <= 0 || percentToHack >= 1)
			throw new RangeError(`Provided ${percentToHack} as percentage to hack, it should be included between 0 (excluded) and 1 (included).`);
		this.percentToHack = percentToHack;
		this.player = player;
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
		this.growThreads = Math.ceil(this.growThreads * GROW_THREADS_MULTIPLIER);
		this.primed.moneyAvailable = this.primed.moneyMax;
		//Weaken 2
		this.weaken2Threads = Math.ceil(ns.growthAnalyzeSecurity(this.growThreads) / this.weakenPower) + 1;
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

	/** @param {boolean} accountForRam */
	getIncomePerSecond() {
		return this.primed.moneyMax
			* this.percentToHack
			* this.hackChance
			* (1000 / this.batchWindow);
	}
}