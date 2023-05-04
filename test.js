import { getServerList } from 'utils.js';

/** @param {NS} ns */
export async function main(ns) {
	ns.tail();
	await ns.sleep(0);
	ns.print('Karma: ' + ns.heart.break().toFixed(0)); //Current Karma
	ns.print('People killed: ' + ns.getPlayer().numPeopleKilled);
	ns.print(`Jobs: ` + JSON.stringify(ns.getPlayer().jobs));
	//ns.moveTail(1597, 258);
	//ns.tprintf('BN Multipliers:\n');
	//const multipliers = JSON.stringify(ns.getBitNodeMultipliers());
	//for (const multiplier of multipliers.split(','))
	//ns.tprintf('\t' + multiplier);
	//ns.tprintf('All servers: \n%s', getServerList(ns));
}