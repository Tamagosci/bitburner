import { loadPreset, resetGrid } from 'stanek.js';

/** @param {NS} ns */
export async function main(ns) {
	let [operation, x = ns.stanek.giftWidth(), y = ns.stanek.giftHeight(), type = 'HACK'] = ns.args;
	switch(operation) {
		case 'reload':
			resetGrid(ns);
		case 'load':
		case '-l':
			loadPreset(ns, x, y, type);
			break;
		case 'unload':
		case 'reset':
			resetGrid(ns);
			break;
		case 'charge':
		case 'charges':
			printCharges(ns);
			break;
	}
}

/** @param {NS} ns */
function printCharges(ns) {
	const fragments = ns.stanek.activeFragments();
	fragments.forEach(f => ns.tprintf(`[${f.x}, ${f.y}] charge: ${f.numCharge.toFixed(0)}`));
}