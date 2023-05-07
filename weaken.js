/** @param {NS} ns */
export async function main(ns) {
	let [target, delay = 0, affectStocks = false, port = 0, data] = ns.args;
	await ns.weaken(target, { additionalMsec: delay, stock: affectStocks });
	if (port !== 0) ns.atExit(() => ns.tryWritePort(port, data ?? ns.pid));
}
