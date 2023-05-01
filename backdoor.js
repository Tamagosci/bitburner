/** @param {NS} ns */
export async function main(ns) {
	let [target = false] = ns.args;
	if (ns.serverExists(target) && ns.hasRootAccess(target))
		backdoorTarget(ns, target);
	else if (target === '-a')
		backdoorAll(ns);
}

/**
 * @param {NS} ns
 * @param {string} target
 * @return {boolean}
 */
export function backdoorTarget(ns, target) {
	//Create and move script
	const filename = 'installBackdoor.js';
	ns.write(filename, 'export let main = ns => ns.singularity.installBackdoor()', 'w');
	ns.scp(filename, target);
	//Execute it
	const pid = ns.exec(filename, target);
	//Delete files
	ns.rm(filename);
	ns.rm(filename, target);

	return pid != 0;
}

/** @param {NS} ns */
function backdoorAll(ns) {
	//TODO
}