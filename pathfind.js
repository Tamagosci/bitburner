/** @param {NS} ns */
export async function main(ns) {
	let [target = 'home', autoPath = false] = ns.args;
	const path = pathToConnectString(pathfind(ns, target));
	if (path === 'ERROR')
		ns.tprint('No path found for ' + target);
	else if (autoPath) {
		//This tries to automatically input path in terminal and press enter
		try {
			const terminalInput = eval('document').getElementById("terminal-input");
			terminalInput.value = path;
			const handler = Object.keys(terminalInput)[1];
			terminalInput[handler].onChange({ target: terminalInput });
			terminalInput[handler].onKeyDown({ key: 'Enter', preventDefault: () => null });
		}
		catch (exception) { ns.tprint('Failed to autopath:\n' + exception.message); }
	}
	else ns.tprint(path);
}

/**
 * @param {NS} ns
 * @param {string} target
 * @return {string[]}
 */
export function pathfind(ns, target) {
	if (target === 'home') return ['home'];
	const paths = new Map([['home', ['home']]]);
	for (const server of paths.keys()) {
		for (const neighbour of ns.scan(server)) {
			if (paths.has(neighbour)) continue;
			const pathToNeighbour = paths.get(server).concat(neighbour);
			if (neighbour.toLowerCase().search(target.toLowerCase()) != -1) return pathToNeighbour;
			paths.set(neighbour, pathToNeighbour);
		}
	}
	return undefined;
}

/**
 * @param {string[]} path
 * @return {string}
 */
export function pathToConnectString(path) {
	return path?.reduce((final, server) => final.concat(`connect ${server};`), '') ?? 'ERROR';
}