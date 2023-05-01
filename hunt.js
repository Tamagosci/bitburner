import { getConsumerTime, runBatchDistributed } from 'consumer.js';
import { getServerList, formatMoney, formatTime } from 'disease.js';
import { HGWBatch } from 'batch.js';
import { Exploit } from 'v1.js';
import { spread } from 'spread.js';
import { expand } from 'expand.js';

let HOST = 'home';

/** @param {NS} ns */
//Find the perfect prey
export async function main(ns) {
	//Arguments
	let [usage = '-h', hackBase = 0.01, maxHack = 1, spacer = 100, loop = true] = ns.args;

	switch (usage) {
		default:
		case '-h':
			ns.tprint('Help: \n\trun hunt.js -h');
			ns.tprint('Auto-run: \n\trun hunt.js -r hackBase=0.01 maxHack=1 spacer=100 loop=true');
			ns.tprint('Find best overall: \n\trun hunt.js -f hackBase=0.01 maxHack=1 spacer=100');
			ns.tprint('Find best % for server: \n\trun hunt.js -s hackBase=0.01 maxHack=1 spacer=100 server');
			ns.tprint('Find sequential: \n\trun hunt.js -o');
			ns.tprint('Hack sequential: \n\trun hunt.js -v percentToHack=0.01');
			return;
		case '-f':
			findBestToBatch(ns, hackBase, maxHack, spacer);
			return;
		case '-r':
			await hunt(ns, hackBase, maxHack, spacer, loop);
			return;
		case '-o':
			ns.tprintf('The best targets for v1 are (in order):\n%s', getBestV1(ns));
			return;
		case '-v':
			await autoV1(ns, hackBase, loop);
			return;
		case '-s':
			if (typeof loop === Boolean) {
				ns.tprint('ERROR Run without arguments to see usage!');
				return;
			}
			const best = iteratePercent(ns, [loop], hackBase, maxHack, spacer);
			reportResult(ns, best);
			return;
	}
}

let ownServers, targetServers, maxRam;

/**
 * @param {NS} ns
 * @param {number} hackBase
 * @param {number} maxHack
 * @param {number} spacer
 * @param {number} maxAttempts
 * @param {boolean} loop
 */
export async function hunt(ns, hackBase, maxHack, spacer, loop) {
	//Logging
	ns.disableLog('ALL');

	//Constants
	HOST = ns.getHostname();

	//Main loop
	do {
		//Infect new targets
		spread(ns);
		//Buy more servers
		expand(ns, 0.9);
		//Find best target
		const best = findBestToBatch(ns, hackBase, maxHack, spacer);
		//Fill all servers but home with batches
		if (await runBatchDistributed(ns, best.batch, false, true) === 0)
			//Fill home ram with batches if no other server can handle it
			await runBatchDistributed(ns, best.batch, true, true);
		//Calculate stats
		const stats = ns.getRunningScript();
		const totalIncome = stats.onlineMoneyMade;
		const totalExp = stats.onlineExpGained;
		const secondsPassed = stats.onlineRunningTime;
		const incomePerSecond = stats.onlineMoneyMade / secondsPassed;
		//Info
		ns.tprintf('<So far this hunt has yielded $%s ($%s/s) and %s xp over %s>',
			formatMoney(totalIncome), formatMoney(incomePerSecond), formatMoney(totalExp), formatTime(secondsPassed * 1000));
		ns.tprintf('Warning: Income per second accuracy fluctuates heavily over time.');
	} while (loop);
}

/**
 * @param {NS} ns
 * @param {number} hackBase
 * @param {number} maxHack
 * @param {number} spacer
 * @param {number} maxAttempts
 * @param {number} maxServers
 * @return {{}}
 */
export function findBestToBatch(ns, hackBase = 0.01, maxHack = 1, spacer = 100, distributed = true) {
	const startTime = performance.now();
	//Report data (in case this is called from another script)
	ns.tprintf('INFO Looking for best parameters with conditions of: \n\thackBase = %s \n\tmaxHack = %s \n\tspacer = %s',
		hackBase, maxHack, spacer);
	//Get consumable servers
	const hackingLevel = ns.getHackingLevel();
	const allServers = getServerList(ns);
	targetServers = allServers
		.filter(server => ns.hasRootAccess(server) && ns.getServerRequiredHackingLevel(server) <= hackingLevel && ns.getServerMaxMoney(server) > 0);
	ownServers = allServers
		.filter(server => ns.getServerMaxRam(server) > 0 && ns.hasRootAccess(server));
	maxRam = Math.max(...ownServers.map(server => ns.getServerMaxRam(server)));
	//Calculate best
	const best = iteratePercent(ns, hackBase, maxHack, spacer);
	//Report results
	reportResult(ns, best);
	ns.tprintf('INFO Simulation took %s.', formatTime(performance.now() - startTime));
	return best;
}

/**
 * @param {NS} ns
 * @param {Server[]} servers
 * @param {number} hackBase
 * @param {number} maxHack
 * @param {number} spacer
 * @return {{}}
 */
function iteratePercent(ns, hackBase, maxHack, spacer) {
	//Find best percentToHack
	const results = [];
	for (let i = hackBase; i <= maxHack; i += hackBase)
		results.push(getBestIncome(ns, i, spacer));

	//Sort by income per second
	results.sort((a, b) => b.income - a.income);

	return results[0];
}

/**
 * @param {NS} ns
 * @param {Server[]} servers
 * @param {number} percentToHack
 * @param {number} spacer
 * @param {number} maxServers
 * @return {{}}
 */
function getBestIncome(ns, percentToHack, spacer) {
	//Batches
	const batches = [];
	for (const server of targetServers)
		batches.push(new HGWBatch(ns, server, percentToHack, spacer, ownServers));
	batches.sort((a, b) => b.income - a.income)
		.filter(batch => batch.batchCost <= maxRam);
	if (batches.length === 0) return { batch: null, income: 0, time: Infinity };
	//Pick the best batch
	const chosen = batches[0];
	const time = getConsumerTime(ns, chosen);
	//Return results
	return {
		batch: chosen, income: chosen.income, time: time,
	};
}

/** @param {NS} ns */
export function getBestV1(ns) {
	const servers = getServerList(ns)
		.filter(server => ns.hasRootAccess(server))
		.filter(server => ns.getServerRequiredHackingLevel(server) <= Math.ceil(ns.getHackingLevel() / 2))
		.sort((a, b) => ns.getServerMaxMoney(b) - ns.getServerMaxMoney(a));
	return servers;
}

/** @param {NS} ns */
async function autoV1(ns, percentToHack, loop) {
	//Logging
	ns.disableLog('ALL');
	//ns.atExit(ns.closeTail);
	ns.tail();
	//Best
	let best;
	do {
		spread(ns);
		best = getBestV1(ns)[0];
		for (let i = 0; i < 10; i++)
			await Exploit(ns, best, percentToHack, false, false);
	} while (loop);
}

/**
 * @param {NS} ns
 * @param {{}} result
 */
function reportResult(ns, result) {
	const target = '\n\ttarget: ' + result.batch.target;
	const percentToHack = '\n\thack: ' + ns.formatPercent(result.batch.percentToHack, 0) + '%';
	const spacer = '\n\tspacer: ' + result.batch.batchSpacer;
	const income = '\n\texpected income: $' + formatMoney(result.income) + '/s';
	const totalIncome = '\n\texpected total gain: $' + formatMoney(result.batch.batchIncome);
	const batches = '\n\texpected batch count: ~' + result.batch.concurrentBatches;
	const ram = '\n\texpected ram cost: ' + ns.formatRam(result.batch.batchCost, 1) + '/ea';
	const duration = '\n\texpected duration: ' + formatTime(result.time);
	ns.tprintf('INFO Found best conditions of:' + target + percentToHack + spacer + income + totalIncome + batches + ram + duration);
}