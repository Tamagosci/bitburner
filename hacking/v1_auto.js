import { upgradeHomeAndBuyPrograms } from 'upgrades/home.js';
import { expandServers } from 'upgrades/servers.js';
import { Exploit } from 'hacking/v1.js';
import { getServerList } from 'utils.js';

const V1_LOOPS_PER_CYCLE = 10;

/** @param {NS} ns */
export async function main(ns) {
	let [percentToHack = 0.1, loop = true] = ns.args;
	await autoV1(ns, percentToHack, loop);
}

/** 
 * @param {NS} ns 
 * @param {number} percentToHack
 * @param {boolean} loop
 */
export async function autoV1(ns, percentToHack = 0.1, loop = true) {
	do {
		//Upgrade home
		upgradeHomeAndBuyPrograms(ns, false);
		//Upgrade servers
		expandServers(ns, 0.2);
		//Recalculate target
		const bestTarget = getBestV1Target(ns);
		//Hack a few times
		for (let i = 0; i < V1_LOOPS_PER_CYCLE; i++)
			await Exploit(ns, bestTarget, 0.1, false, false);
	} while (loop);
}

/** 
 * @param {NS} ns 
 * @return {string} Name of the best server to target with v1
 */
export function getBestV1Target(ns) {
	const servers = getServerList(ns)
		.filter(server => ns.hasRootAccess(server))
		.filter(server => ns.getServerRequiredHackingLevel(server) <= ns.getHackingLevel())
		.sort((a, b) => ns.getServerMaxMoney(b) - ns.getServerMaxMoney(a));
	return servers[0];
}