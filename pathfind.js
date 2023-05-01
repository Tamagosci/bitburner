/** @param {NS} ns */
export async function main(ns) {
	let [target, autoPath = true] = ns.args;
	pathfind(ns, target, autoPath);
}

const NONE_FOUND = 'No path found for the specified target.';

export function pathfind(ns, target, autoPath) {
	const servers = recursiveScan(ns);
	let path = NONE_FOUND;
	for (const server of servers)
		if (server.name.toLowerCase().search(target.toLowerCase()) != -1)
			path = server.route;
	if (path === NONE_FOUND || !autoPath)
		ns.tprint(path);
	else {
		//This tries to automatically input path in terminal and press enter
		try {
			const terminalInput = eval('document').getElementById("terminal-input");
			terminalInput.value = path;
			const handler = Object.keys(terminalInput)[1];
			terminalInput[handler].onChange({ target: terminalInput });
			terminalInput[handler].onKeyDown({ key: 'Enter', preventDefault: () => null });
		}
		catch (exception) { ns.tprintf('Failed to autopath:\n%s', exception.message); }
	}
}

function recursiveScan(ns, root, found, route) {
	if (route == null) route = '';
	else route = route + ';connect ' + root;
	if (found == null) found = new Array();
	if (root == null) {
		root = 'home';
		route = 'connect home';
	}
	if (found.find(p => p == root) == undefined) {
		var entry = {};
		entry.name = root;
		entry.route = route;
		found.push(entry);
		for (const server of ns.scan(root))
			if (found.find(p => p.name == server) == undefined)
				recursiveScan(ns, server, found, route);
	}
	return found;
}