import { getServerList } from 'utils.js';

/** @param {NS} ns */
export async function main(ns) {
	let [includeHome = true] = ns.args;
	const servers = getServerList(ns, includeHome);
	for (const server of servers)
		ns.killall(server, true);
}