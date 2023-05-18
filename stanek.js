import { getServerList } from 'utils.js';

const PRESETS = {
	'5x5': [
		{ "x": 1, "y": 0, "rotation": 2, "id": 0 },
		{ "x": 3, "y": 3, "rotation": 0, "id": 1 },
		{ "x": 3, "y": 0, "rotation": 1, "id": 5 },
		{ "x": 0, "y": 4, "rotation": 0, "id": 6 },
		{ "x": 0, "y": 0, "rotation": 1, "id": 7 },
		{ "x": 5, "y": 0, "rotation": 1, "id": 20 },
		{ "x": 0, "y": 2, "rotation": 0, "id": 102 }
	],
}

/** @param {NS} ns */
export async function main(ns) {
	let [targetCharge] = ns.args;
	if (targetCharge !== undefined && isNaN(targetCharge)) printGrid(ns);
	else if (ns.stanek.activeFragments().length === 0) {
		if (ns.stanek.acceptGift() === false) throw new Error('ERROR Failed to join the Church of the Machine God');
		setupGift(ns);
		await charge(ns, targetCharge);
	}
	else await charge(ns, targetCharge);
}

const CHARGE_SCRIPT = 'charge-stanek.js';
const SLEEP = 30e3;

/** @param {NS} ns */
async function charge(ns, target) {
	//Logging
	ns.tail();

	//Calculate target charge if it's not provided
	//const targetCharge = target ?? Math.log2(ns.getServerMaxRam('home')) * 100;
	const targetCharge = target ?? Math.max(ns.getServerMaxRam('home'), 200);
	ns.print(`INFO Target charge is ${targetCharge}`);

	//Declare variables
	const charging = [];
	let ramServers = [];
	let minRam = 0;
	let fragments = [];
	let freeRam = 0;
	let threadsPerFragment = 1;

	ns.atExit(() => charging.forEach(fragment => ns.kill(fragment.pid)));

	while (true) { //TODO: Add thread balancing if charge is not equal between frags
		//Kill existing processes
		while (charging.length > 0) 
			ns.kill(charging[0].pid, charging.shift().host);

		//Update fragments data
		fragments = ns.stanek.activeFragments().filter(fragment => fragment.highestCharge > 0);

		//Check if all fragments reached the target charge level
		if (fragments.every(fragment => fragment.numCharge >= targetCharge)) break;

		//Update host list
		minRam = fragments.length * 2;
		ramServers = getServerList(ns, true, false).filter(server => ns.getServerMaxRam(server) >= minRam);

		//Start new chargers
		for (const server of ramServers) {
			freeRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
			threadsPerFragment = Math.floor(freeRam / fragments.length / 2);
			if (threadsPerFragment === 0) continue;
			ns.scp(CHARGE_SCRIPT, server, 'home');

			for (const fragment of fragments)
				charging.push({
					x: fragment.x,
					y: fragment.y,
					host: server,
					pid: ns.exec(CHARGE_SCRIPT, server, threadsPerFragment, fragment.x, fragment.y)
				});
		}

		ns.print(`INFO Target charge is ${targetCharge}`);
		ns.print(`INFO Current charge is around ${fragments[0].numCharge.toFixed(2)}`);
		ns.print(`Sleeping...`);
		await ns.sleep(SLEEP);
	}

	ns.print(`SUCCESS All fragments reached current target of ${targetCharge}`);
}

/** @param {NS} ns */
function setupGift(ns) {
	const preset = ns.stanek.giftWidth() + 'x' + ns.stanek.giftHeight();
	const grid = PRESETS[preset];
	if (grid === undefined) throw new Error(`ERROR No preset available for a ${preset} gift`);
	for (const fragment of grid)
		ns.stanek.placeFragment(fragment.x, fragment.y, fragment.rotation, fragment.id);
}

/** @param {NS} ns */
function printGrid(ns) {
	const fragments = ns.stanek.activeFragments().sort((a, b) => a.id - b.id);
	ns.tprint('Current Stanek\'s grid:')
	fragments.forEach(f => ns.tprintf(`{x: ${f.x}, y: ${f.y}, rotation: ${f.rotation}, id: ${f.id}}`));
}
