/** @param {NS} ns */
//Each loop will try in order: Buy levels > Buy ram  > Buy cores > Buy cache > Buy nodes
export async function main(ns) {
	let [maxAllowedNodes = 21, loop = true] = ns.args;
	await upgradeHacknet(ns, maxAllowedNodes, loop);
}

export async function upgradeHacknet(ns, maxAllowedNodes, loop) {
	//Each loop will try in order: Buy levels > Buy ram  > Buy cores > Buy cache > Buy nodes
	let delta = 0;
	do {
		//Try to buy new nodes
		const maxNodes = ns.hacknet.maxNumNodes();
		while (ns.hacknet.numNodes() < Math.min(maxAllowedNodes, maxNodes) && ns.hacknet.purchaseNode() >= 0);

		//Wait to improve efficency of cheap upgrades
		await ns.sleep(1000);

		//Loop all owned nodes
		const nodesOwned = ns.hacknet.numNodes();
		ns.printf('Starting loop with delta %s and %s nodes owned.', delta, nodesOwned);
		for (let i = delta; i < nodesOwned; i++) {
			ns.printf('Upgrading node %s.', i);
			//Buy as many levels as possible
			while (ns.hacknet.upgradeLevel(i, 1));
			//Buy as much ram as possible
			while (ns.hacknet.upgradeRam(i, 1));
			//Buy as many cores as possible
			while (ns.hacknet.upgradeCore(i, 1));
			//Buy as much cache as possible
			while (ns.hacknet.upgradeCache(i, 1));

			//Check if node delta is maxed
			if (isNodeMaxed(ns.hacknet.getNodeStats(delta))) {
				ns.printf('INFO Hacknet node %s is maxed, incrementing delta.', delta);
				delta++;
				//Check if all nodes are maxed
				if (delta == maxAllowedNodes || delta == ns.hacknet.maxNumNodes()) {
					ns.tprintf('SUCCESS Maxed out %s hacknet nodes.', delta);
					return;
				}
			}

			//Wait to improve efficency of cheap upgrades
			await ns.sleep(1000);
		}
	} while (loop);
}

function isNodeMaxed(nodeStats) {
	if (nodeStats.level == 200 && nodeStats.ram == 64 && nodeStats.cores == 16)
		return true;
	else
		return false;
}