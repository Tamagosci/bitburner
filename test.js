import { getServerList } from 'utils.js';

/** @param {NS} ns */
export async function main(ns) {
	ns.tail();
	await ns.sleep(0);
	ns.resizeTail(600, 1300);
	ns.moveTail(1100, 25);

	const hackSecurity = ns.hackAnalyzeSecurity(1);
	const growSecurity = ns.growthAnalyzeSecurity(1);
	const weakenSecurity = ns.weakenAnalyze(1);
	ns.print(`Hack increases security by ${hackSecurity}`);
	ns.print(`Grow increases security by ${growSecurity}`);
	ns.print(`Weaken lowers security by ${weakenSecurity}`);
	ns.print(`You need 1 weaken thread every ${weakenSecurity/hackSecurity} hack threads`);
	ns.print(`You need 1 weaken thread every ${weakenSecurity/growSecurity} grow threads`);
	for (let exponent = 1; exponent < 100; exponent++)
		ns.print(`1e${exponent} => ${ns.formatNumber(Number.parseFloat(`1e${exponent}`), 1)}`)
}