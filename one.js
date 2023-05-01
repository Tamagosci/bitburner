//Checks are (ram >= THRESHOLD)
const CORP_THRESHOLD = 2048;
const SOLVER_THRESHOLD = 256;
const STOCK_THRESHOLD = 128;

const HOME = 'home';

/** @param {NS} ns */
export async function main(ns) {
	//This is supposed to be ran exclusively from home
	if (ns.getHostname() !== HOME) return;
	//Run scripts if conditions allow
	const ram = ns.getServerMaxRam(HOME);
	if (ram >= CORP_THRESHOLD) {
		if (ns.corporation.hasCorporation())
			ns.run('nest.js');
		else
			ns.run('build-nest.js');
	}
	if (ram >= SOLVER_THRESHOLD) ns.run('solve.js', 1, true);
	if (ram >= STOCK_THRESHOLD) ns.run('drain.js');
	ns.run('hunt.js', 1, '-r', 0.01, 1, 60, true);
}