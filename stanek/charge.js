/** @param {NS} ns */
export async function main(ns) {
	let [x, y] = ns.args;
	if (x === undefined || y === undefined) return;
	while (true) await ns.stanek.chargeFragment(x, y);
}