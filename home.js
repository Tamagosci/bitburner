/** @param {NS} ns */
export async function main(ns) {
	let [loop = true] = ns.args;
	await upgradeHomeAndBuyPrograms(ns, loop);
}

const MAX_HOME_RAM = 2 ** 30;
const MAX_HOME_CORES = 8;
const SLEEP_TIME = 60e3;

/**
 * @param {NS} ns
 * @param {boolean} loop
 */
export async function upgradeHomeAndBuyPrograms(ns, loop = false) {
	let doesOwnAllPrograms = isDarkwebMaxed(ns);
	let isHomeMaxed = false;
	do {
		//Upgrade home computer
		if (isHomeMaxed === false) {
			if (ns.singularity.upgradeHomeRam()) ns.print('Upgraded home ram.');
			if (ns.singularity.upgradeHomeCores()) ns.print('Upgraded home cores');
			const homeServer = ns.getServer('home');
			isHomeMaxed = homeServer.cpuCores === MAX_HOME_CORES && homeServer.maxRam === MAX_HOME_RAM;
		}
		//Max darkweb
		if (doesOwnAllPrograms === false) {
			buyDarkweb(ns);
			doesOwnAllPrograms = isDarkwebMaxed(ns);
		}
		if (loop) await ns.sleep(SLEEP_TIME);
	} while (loop && !doesOwnAllPrograms && !isHomeMaxed);
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