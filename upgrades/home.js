/** @param {NS} ns */
export async function main(ns) {
	let [loop = true] = ns.args;
	upgradeHomeAndBuyPrograms(ns);
	if (!loop) return;
	//Next is only for loops
	while (loop) {
		await ns.sleep(SLEEP_TIME);
		upgradeHomeAndBuyPrograms(ns);
	} 
}

const MAX_HOME_RAM = 2 ** 30;
const MAX_HOME_CORES = 8;
const SLEEP_TIME = 60e3;

/**
 * @param {NS} ns
 * @param {boolean} loop
 */
export function upgradeHomeAndBuyPrograms(ns) {
	//Upgrade home computer
	while (ns.singularity.upgradeHomeRam()) ns.print(`Upgraded home ram to ${ns.formatRam(ns.getServer('home').maxRam, 0)}.`);
	while (ns.singularity.upgradeHomeCores()) ns.print(`Upgraded home cores to ${ns.getServer('home').cpuCores}.`);
	//Max darkweb
	buyDarkweb(ns);
}

/** @param {NS} ns */
function buyDarkweb(ns) {
	//Buy tor router
	if (!ns.singularity.purchaseTor()) return;
	//Buy programs
	ns.singularity.getDarkwebPrograms().forEach(program => {
		if (!ns.fileExists(program, 'home') && ns.singularity.purchaseProgram(program)) ns.print(`Purchased ${program}`)
	});
}

/** 
 * @param {NS} ns 
 * @return {boolean}
 */
function isDarkwebMaxed(ns) {
	return ns.singularity.purchaseTor() && ns.singularity.getDarkwebPrograms().every(program => ns.fileExists(program, 'home'));
}