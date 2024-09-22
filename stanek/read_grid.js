/** @param {NS} ns */
export async function main(ns) {
	readGrid(ns);
}
/** @param {NS} ns */
function readGrid(ns) {
	const fragments = ns.stanek.activeFragments();
	ns.tail()
	ns.clearLog()
	const fragmentData = fragments.map(fragment => ({
		x: fragment.x,
		y: fragment.y,
		rotation: fragment.rotation,
		id: fragment.id
	}));
	fragmentData.sort((a, b) => a.id - b.id);
	fragmentData.forEach(fragment => 
		ns.print(`{x: ${fragment.x}, y: ${fragment.y}, rotation: ${fragment.rotation}, id: ${fragment.id}},`)
	);
}