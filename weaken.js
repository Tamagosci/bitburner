/** @param {NS} ns */
export async function main(ns) {
	let [target, delay = 0, affectStocks = false] = ns.args;
	await ns.weaken(target, {additionalMsec: delay, stock: affectStocks});
}