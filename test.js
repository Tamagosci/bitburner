import { getServerList } from 'disease.js';

/** @param {NS} ns */
export async function main(ns) {
	ns.tail();
	await ns.sleep(0);
	ns.printf('Karma: ' + ns.heart.break().toFixed(0)); //Current Karma
	ns.printf('People killed: ' + ns.getPlayer().numPeopleKilled);
	ns.moveTail(2022, 246);
	//ns.tprintf('BN Multipliers:\n');
	//const multipliers = JSON.stringify(ns.getBitNodeMultipliers());
	//for (const multiplier of multipliers.split(','))
	//ns.tprintf('\t' + multiplier);
	//ns.tprintf('All servers: \n%s', getServerList(ns));
}