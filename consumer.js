import { formatMoney, formatTime } from 'disease.js';
import { HGWBatch } from 'batch.js';

const FREE_RAM = 64;
const MAX_SERVER_BATCHES = 1000;
const MAX_TOTAL_BATCHES = 10e3;
const HOME = 'home';
const SCRIPTS = ['hack.js', 'grow.js', 'weaken.js'];

/** @param {NS} ns */
export async function main(ns) {
	//Arguments
	let [target, percentToHack = 0.1, spacer = 100, includeHome = false, loop = true] = ns.args;

	if (target === '-h') {
		ns.tprint('Usage: run consumer.js targetServer percentToHack=0.1 spacer=100 includeHome=false loop=true');
		ns.exit();
	}

	//Calculate batch
	const batch = new HGWBatch(ns, target, percentToHack, spacer);

	await consume(ns, batch, includeHome, loop);
}

/**
 * @param {NS} ns
 * @param {HGWBatch} batch
 * @param {boolean} loop
 */
export async function consume(ns, batch, includeHome, loop) {
	//Formulas warning
	if (!ns.fileExists('Formulas.exe', 'home')) {
		ns.tprint('WARN Running without formulas.exe, this may cause failure in the long run!');
		if (percentToHack > 0.90) {
			percentToHack = 0.90;
			ns.tprint('WARN Can\'t hack too much of the server money if formulas API is not available, lowering to 90%.');
		}
	}

	if (loop) ns.tprint('WARN Running in loop mode, this might break as hack level goes up.\n Try run hunt.js -r instead.');

	//Main loop
	do {
		//Compensate for possible level ups
		batch.update(ns);
		printBatchDetails(ns, batch);
		//Run batches
		await runBatchDistributed(ns, batch, includeHome, true);
	} while (loop);
}

/**
 * @param {NS} ns
 * @param {HGWBatch} batch
 * @param {boolean} includeHome
 * @param {boolean} waitUntilEnd
 * @return Number of batches started
 */
export async function runBatchDistributed(ns, batch, includeHome, waitUntilEnd) {
	let totalBatchCounter = 0;
	let serversUsed = 0
	const jobsToSkip = getJobsToSkip(ns, batch);
	ns.tprintf(`Planning to skip ${jobsToSkip.hack} hack jobs and ${jobsToSkip.grow} grow jobs.`);
	for (const server of batch.servers) {
		const maxRam = ns.getServerMaxRam(server);
		if (maxRam < batch.batchCost) continue;
		serversUsed++;
		let serverBatchCounter = 0;
		ns.scp(SCRIPTS, server, HOME);
		// v This is too keep some free ram on home v
		const bonusCost = (server === HOME && maxRam - FREE_RAM >= batch.batchCost) ? FREE_RAM : 0;
		const batchCost = ((totalBatchCounter < jobsToSkip.hack ? 0 : batch.hackThreads) + (totalBatchCounter < jobsToSkip.grow ? 0 : batch.growThreads) + batch.weakenThreads) * 1.75;
		while (batchCost <= maxRam - ns.getServerUsedRam(server) - bonusCost) {
			//Run batch with additionalMsec
			if (totalBatchCounter >= jobsToSkip.hack)
				ns.exec('hack.js', server, batch.hackThreads, batch.target, batch.hackDelay + batch.batchSpacer * totalBatchCounter);
			if (totalBatchCounter >= jobsToSkip.grow)
				ns.exec('grow.js', server, batch.growThreads, batch.target, batch.growDelay + batch.batchSpacer * totalBatchCounter);
			ns.exec('weaken.js', server, batch.weakenThreads, batch.target, batch.weakenDelay + batch.batchSpacer * totalBatchCounter);
			serverBatchCounter++;
			totalBatchCounter++;
			if (serverBatchCounter >= MAX_SERVER_BATCHES) break;
			if (totalBatchCounter % 1000 === 0) await ns.sleep(50); //This gets rid of 'Did you forget to await a function' for high batch count values
		}
		if (totalBatchCounter >= MAX_TOTAL_BATCHES) break;
	}
	if (serversUsed > 0) {
		ns.tprintf('SUCCESS Started %s concurrent batches filling %s of ram over %s servers.', 
			totalBatchCounter, ns.formatRam(totalBatchCounter * batch.batchCost, 1), serversUsed);
		if (waitUntilEnd) {
			ns.tprintf('INFO  Startup: %s    Earning: %s    Total: %s', formatTime(batch.deadTime), formatTime(batch.earningTime), formatTime(batch.batchTime));
			ns.tprintf('Waiting for batches to finish...');
			await ns.sleep(batch.batchTime + 1e3); //Extra is for safety
		}
	}
	else ns.tprint('WARN Failed to run any batch on any server' + (includeHome) ? '.' : ' other than home.');
	return totalBatchCounter;
}

/**
 * @param {NS} ns
 * @param {HGWBatch} batch
 * @return {{hack: number, grow: number}}
 */
function getJobsToSkip(ns, batch) {
	let hackJobsToSkip = 0;
	let growJobsToSkip = 0;
	const server = ns.getServer(batch.target);
	const player = ns.getPlayer();
	//Not enough money
	if (server.moneyAvailable < server.moneyMax) {
		const growThreadsRequired = ns.formulas.hacking.growThreads(server, player, server.moneyMax);
		hackJobsToSkip = Math.ceil(growThreadsRequired / batch.growThreads);
		server.hackDifficulty = Math.max(server.hackDifficulty - ns.hackAnalyzeSecurity(hackJobsToSkip * batch.hackThreads), server.minDifficulty);
	}
	//Too much security
	if (server.hackDifficulty > server.minDifficulty) {
		const extraDifficulty = server.hackDifficulty - server.minDifficulty;
		const difficultyLostFromSkippingOneBatch = ns.hackAnalyzeSecurity(batch.hackThreads) + ns.growthAnalyzeSecurity(batch.growThreads);
		const batchesToSkip = Math.ceil(extraDifficulty / difficultyLostFromSkippingOneBatch);
		hackJobsToSkip += batchesToSkip;
		growJobsToSkip += batchesToSkip;
	}
	return {hack: hackJobsToSkip, grow: growJobsToSkip};
}

function getLevelUpCompensationData(ns, batch, jobsToSkip) {
	//Player levels up midway
	const levelUps = [];
	const hackThreadAmounts = [batch.hackThreads];
	const expPerJob = ns.formulas.hacking.hackExp(server, player); //Only cares about server.baseDifficulty, accounts for xp bonuses
	const totalHackThreads = batch.hackThreads * (batch.concurrentBatches - jobsToSkip.hack);
	const totalGrowThreads = batch.growThreads * (batch.concurrentBatches - jobsToSkip.grow);
	const totalWeakenThreads = batch.weakenThreads * batch.concurrentBatches;
	let totalExpGained = expPerJob * (totalHackThreads + totalGrowThreads + totalWeakenThreads);
	const hackExpPerBatch = batch.hackThreads * expPerJob;
	const growExpPerBatch = batch.growThreads * expPerJob;
	const weakenExpPerBatch = batch.weakenThreads * expPerJob;
	let batchesConsidered = 0;
	do {
		const expToNextLevel = ns.formulas.skills.calculateExp(player.skills.hacking + 1, player.mults.hacking) - player.exp.hacking;
		if (totalExpGained > expToNextLevel) {
			//Calculate when it levels up
			let accumulatedExp = 0;
			while (accumulatedExp < expToNextLevel) {
				batchesConsidered++;
				accumulatedExp += weakenExpPerBatch;
				if (batchesConsidered > jobsToSkip.grow)
					accumulatedExp += growExpPerBatch;
				if (batchesConsidered > jobsToSkip.hack)
					accumulatedExp += hackExpPerBatch;
			}
			levelUps.push(batchesConsidered + 1);
			//Update values
			totalExpGained -= expToNextLevel;
			player.exp.hacking += expToNextLevel;
			player.skills.hacking++;
			//Calculate new hackThreads after levelups
			const hackPercent = ns.formulas.hacking.hackPercent(batch.primed, player);
			hackThreadAmounts.push(Math.max(Math.floor(batch.percentToHack / hackPercent), 1));
		}
		else break;
	} while (false);
}


/**
 * @param {NS} ns
 * @param {HGWBatch} batch
 * @return {number}
 */
export function getConsumerCost(ns, batch) {
	//return batch.totalCost + getPrimerCost(ns, batch.target) + ns.getScriptRam('consumer.js');
	return ns.getServerMaxRam(batch.host) - FREE_RAM - ns.getServerUsedRam(batch.host);
}

/**
 * @param {NS} ns
 * @param {HGWBatch} batch
 * @return {number}
 */
export function getConsumerTime(ns, batch) { //TODO: Account for corrective half-batches
	return batch.batchTime;
}

/**
 * @param {NS} ns
 * @param {HGWBatch} batch
 */
function printBatchDetails(ns, batch) {
	ns.tprintf('INFO Starting to consume %s.', batch.target);
	ns.tprintf('INFO Planning %s concurrent batches with a cost of %s each, for a total of %s of ram.',
		batch.concurrentBatches, ns.formatRam(batch.batchCost), ns.formatRam(batch.batchCost * batch.concurrentBatches));
	ns.tprintf('INFO Each batch will have an estimated duration of %s.', formatTime(batch.batchTime));
	ns.tprintf('INFO Each batch will attempt to hack %s of the target\'s money.', ns.formatPercent(batch.percentToHack, 0));
	ns.tprintf('INFO Batches will be launched with a spacer of %s seconds.', formatTime(batch.batchSpacer));
	ns.tprintf('INFO Expected income is %s$/s for a total of %s$. (WIP)', formatMoney(batch.income), formatMoney(batch.batchIncome));
}