import { pathfind } from 'pathfind.js';

const MEANINGFUL_TARGETS = [
	'CSEC', 'avmnite-02h', 'I.I.I.I', 'run4theh111z', 'fulcrumassets'
]
const REDPILL_TARGETS = ['The-Cave', 'w0r1d_d43m0n'];

/** @param {NS} ns */
export async function main(ns) {
	let [target] = ns.args;
	if (target === undefined) await backdoorAll(ns);
	else await backdoorTarget(ns, target);
}

/**
 * @param {NS} ns
 * @param {string} target
 */
export async function backdoorTarget(ns, target) {
	for (const server of pathfind(ns, target))
		ns.singularity.connect(server);
	try { await ns.singularity.installBackdoor(); }
	catch { ns.tprint('WARN Failed to backdoor ' + target); }
	ns.singularity.connect('home');
}

/** @param {NS} ns */
async function backdoorAll(ns) {
	for (const server of MEANINGFUL_TARGETS)
		await backdoorTarget(ns, server);
	if (!ns.singularity.getOwnedAugmentations(false).includes('The Red Pill')) return;
	for (const server of REDPILL_TARGETS)
		await backdoorTarget(ns, server);
}