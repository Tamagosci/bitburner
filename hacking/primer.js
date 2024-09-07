import { getServerList, formatTime } from 'utils.js';

/** @param {NS} ns */
//Weaken and Grow to the limit
export async function main(ns) {
	//Arguments
	const [target] = ns.args;

	if (target == '-a')
		await primeAll(ns);
	else
		await prime(ns, target);
}

const SCRIPTS = ['hacking/hack.js', 'hacking/grow.js', 'hacking/weaken.js'];
const MIN_SLEEP = 1e3;
const HOME = 'home';

let hosts, totalAvailableRam;

/**
 * @param {NS} ns
 * @param {string} target
 * @param {boolean} useHome
 */
export async function prime(ns, target, useHome = false) {
	ns.tprintf('INFO Starting to prime %s.', target);

	//Skip if there is nothing to do
	if (isPrimed(ns, target)) { ns.tprintf('SUCCESS Target %s is already primed.', target); return; }

	hosts = getServerList(ns, useHome).filter(host => ns.getServerMaxRam(host) > 0 && ns.hasRootAccess(host));
	totalAvailableRam = hosts.reduce((total, host) => total + ns.getServerMaxRam(host) - ns.getServerUsedRam(host), 0);
	ns.tprintf('Detected a total ram pool of ' + ns.formatRam(totalAvailableRam));

	//Weaken to min
	if (!isSecurityPrimed(ns, target))
		await weakenToMin(ns, target, hosts);

	//Grow to max
	if (!isMoneyPrimed(ns, target))
		await growToMax(ns, target, hosts);

	ns.tprintf('SUCCESS Target %s primed successfully!', target);
}

/** @param {NS} ns */
async function primeAll(ns) {
	const servers = getServerList(ns)
		.filter(server => ns.hasRootAccess(server))
		.filter(server => isPrimed(ns, server) == false)
		.sort((a, b) => ns.getServerRequiredHackingLevel(a) - ns.getServerRequiredHackingLevel(b));
	ns.tprintf('Starting to prime %s servers.', servers.length);
	for (const server of servers)
		await prime(ns, server);
	ns.tprint('SUCCESS Primed all available servers!');
}

/**
 * @param {NS} ns
 * @param {string} target
 * @return {boolean}
 */
export function isPrimed(ns, target) {
	return isSecurityPrimed(ns, target) && isMoneyPrimed(ns, target);
}

/**
 * @param {NS} ns
 * @param {string} target
 * @return {boolean}
 */
function isSecurityPrimed(ns, target) { return ns.getServerSecurityLevel(target) === ns.getServerMinSecurityLevel(target); }

/**
 * @param {NS} ns
 * @param {string} target
 * @return {boolean}
 */
function isMoneyPrimed(ns, target) { return ns.getServerMoneyAvailable(target) === ns.getServerMaxMoney(target); }

/**
 * @param {NS} ns
 * @param {string} target
 */
export async function weakenToMin(ns, target) {
	//Calculate weaken pass details
	const pass = getWeakenPass(ns, target);
	//Info dump
	const sleepTime = ns.getWeakenTime(target);
	ns.tprintf('INFO Full weaken pass RAM cost:  ' + ns.formatRam(pass.totalRamCost));
	if (pass.expectedCycleCount > 1) {
		ns.tprintf('INFO Starting weaken loop with an expected cycle count of %s and time per cycle of %s, for a total time of %s.',
			pass.expectedCycleCount,
			formatTime(sleepTime),
			formatTime(pass.expectedCycleCount * sleepTime));
		ns.tprintf('WARN The total time prediction is higher than the time it will actually take.');
	}
	else
		ns.tprintf('INFO Starting single weaken loop with an expected completition time of %s.', formatTime(sleepTime));
	//Weaken loop
	let remainingThreads = pass.totalWeakenThreads;
	ns.tprint(`DEBUG RemainingThreads = ${remainingThreads}`);
	if (remainingThreads === 0) return;
	while (ns.getServerSecurityLevel(target) > pass.minSec) {
		for (const host of hosts) {
			const availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
			if (availableRam < 1.75) continue;
			const weakenThreads = Math.min(Math.floor(availableRam / 1.75), remainingThreads);
			ns.scp(SCRIPTS, host, HOME);
			ns.exec('hacking/weaken.js', host, weakenThreads, target);
			remainingThreads -= weakenThreads;
			if (remainingThreads <= 0) break;
		}
		await ns.sleep(ns.getWeakenTime(target) + MIN_SLEEP);
	}
}

/**
 * @param {NS} ns
 * @param {string} target
 */
export async function growToMax(ns, target) {
	//Calculate growth pass details
	const pass = getGrowthPass(ns, target);
	//Info dump
	const sleepTime = ns.getWeakenTime(target);
	ns.tprintf('INFO Full growth pass RAM cost: ' + ns.formatRam(pass.totalRamCost));
	if (pass.expectedCycleCount > 1)
		ns.tprintf('INFO Starting growth loop with an expected cycle count of %s and time per cycle of %s, for a total time of %s.',
			pass.expectedCycleCount,
			formatTime(sleepTime),
			formatTime(pass.expectedCycleCount * sleepTime));
	else
		ns.tprintf('INFO Starting single growth loop with an expected completition time of %s.', formatTime(sleepTime));
	//Growth loop
	const ratio = (ns.weakenAnalyze(1) / ns.growthAnalyzeSecurity(1)) + 1;
	let remainingThreads = pass.totalGrowThreads;
	if (remainingThreads === 0) return;
	while (ns.getServerMoneyAvailable(target) < pass.maxMoney) {
		for (const host of hosts) {
			const availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
			const threadsCapacity = Math.floor(availableRam / 1.75);
			if (threadsCapacity < 2) continue;
			const weakenThreads = Math.max(Math.min(Math.ceil(threadsCapacity / ratio), pass.totalWeakenThreads), 1);
			const growthThreads = Math.max(Math.min(threadsCapacity - weakenThreads, pass.totalGrowThreads), 1);
			ns.scp(SCRIPTS, host, HOME);
			ns.exec('hacking/grow.js', host, growthThreads, target);
			ns.exec('hacking/weaken.js', host, weakenThreads, target);
			remainingThreads -= growthThreads;
			if (remainingThreads <= 0) break;
		}
		await ns.sleep(ns.getWeakenTime(target) + MIN_SLEEP);
	}
}

/**
 * @param {NS} ns
 * @param {string} target
 * @return {{maxMoney: number, expectedCycleCount: number, totalWeakenThreads: number, totalRamCost: number}}
 */
function getWeakenPass(ns, target) {
	//Get required stats
	const minSec = ns.getServerMinSecurityLevel(target);
	const currentSec = ns.getServerSecurityLevel(target);
	//Calculate total threads required
	const totalWeakenThreads = Math.ceil((currentSec - minSec) / ns.weakenAnalyze(1));
	//Calculate max threads per pass
	const totalRamCost = totalWeakenThreads * 1.75;
	const expectedCycleCount = Math.ceil(totalRamCost / totalAvailableRam);

	return {
		minSec: minSec, expectedCycleCount: expectedCycleCount,
		totalWeakenThreads: totalWeakenThreads,
		totalRamCost: totalRamCost,
	};
}

/**
 * @param {NS} ns
 * @param {string} target
 * @return {{maxMoney: number, expectedCycleCount: number, totalGrowThreads: number, totalWeakenThreads: number, totalRamCost: number}}
 */
function getGrowthPass(ns, target) {
	//Get required stats
	const maxMoney = ns.getServerMaxMoney(target);
	let currentMoney = ns.getServerMoneyAvailable(target);
	if (currentMoney < 20) currentMoney = 20;
	//Calculate total threads required
	const totalGrowThreads = Math.ceil(ns.growthAnalyze(target, maxMoney / currentMoney));
	const totalWeakenThreads = Math.ceil(totalGrowThreads * 0.2);
	//Calculate max threads per pass
	const totalRamCost = (totalGrowThreads + totalWeakenThreads) * 1.75;
	const expectedCycleCount = Math.ceil(totalRamCost / totalAvailableRam);

	return {
		maxMoney: maxMoney, expectedCycleCount: expectedCycleCount,
		totalGrowThreads: totalGrowThreads,
		totalWeakenThreads: totalWeakenThreads,
		totalRamCost: totalRamCost,
	};
}

/**
 * @param {NS} ns
 * @param {string} target
 * @param {boolean} useHome
 * @return {number}
 */
export function getPrimerTime(ns, target, useHome = false) {
	totalAvailableRam = getServerList(ns, useHome)
		.filter(host => ns.getServerMaxRam(host) > 0 && ns.hasRootAccess(host))
		.reduce((total, host) => total + ns.getServerMaxRam(host) - ns.getServerUsedRam(host), 0);
	return ns.getWeakenTime(target) * (getGrowthPass(ns, target).expectedCycleCount + getWeakenPass(ns, target).expectedCycleCount);
}

/**
 * @param {NS} ns
 * @param {string} target
 * @return {number}
 */
export function getPrimerCost(ns, target) {
	const host = ns.getHostname();
	const maxAvailableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
	return Math.max(getGrowthPass(ns, target, maxAvailableRam).totalRamCost, getWeakenPass(ns, target, maxAvailableRam).totalRamCost)
		+ ns.getScriptRam('hacking/primer.js');
}