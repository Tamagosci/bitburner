import { getServerList } from 'disease.js';
/** @param {NS} ns */
//The plague learns
export let main = ns => learn(ns);

export function learn(ns) {
	const servers = getServerList(ns);
	const extensions = ['.lit', '.txt'];
	const known = [];

	for (let extension of extensions) {
		known.push(ns.ls('home', extension));
		for (let server of servers) {
			const files = ns.ls(server, extension).filter(file => !known.includes(file));
			ns.scp(files, 'home', server);
			known.push(files);
		}
	}
}