import { getServerList } from 'utils.js';
import { infect } from 'servers/infect.js';
/** @param {NS} ns */
export let main = ns => spread(ns);

export function spread(ns) { 
	getServerList(ns)
		.filter(server => ns.hasRootAccess(server) === false)
		.forEach(server => infect(ns, server));
}