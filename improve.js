/** @param {NS} ns */
export async function main(ns) {
	let [loop = true] = ns.args;
	await evolve(ns, loop);
}

/**
 * @param {NS} ns
 * @param {boolean} loop
 */
export async function evolve(ns, loop) {
	let ownAllPrograms = isDarkwebMaxed(ns);
	do {
		//Upgrade home computer
		ns.singularity.upgradeHomeRam();
		ns.singularity.upgradeHomeCores();
		//Max darkweb
		if (ownAllPrograms === false) {
			buyDarkweb(ns);
			ownAllPrograms = isDarkwebMaxed(ns);
		}
		await ns.sleep(60e3);
	} while (loop);
}

/** @param {NS} ns */
function buyDarkweb(ns) {
	//Buy tor router
	if (!ns.singularity.purchaseTor()) return;
	//Buy programs
	const programs = ns.singularity.getDarkwebPrograms();
	for (const program of programs)
		ns.singularity.purchaseProgram(program);
}

/** 
 * @param {NS} ns 
 * @return {boolean}
 */
function isDarkwebMaxed(ns) {
	for (const program of ns.singularity.getDarkwebPrograms())
		if (ns.fileExists(program, 'home') === false)
			return false;
	return true;
}