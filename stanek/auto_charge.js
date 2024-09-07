import { getServerList } from 'utils.js';

/** @param {NS} ns */
export async function main(ns) {
	let [targetCharge] = ns.args;
	if (targetCharge !== undefined && isNaN(targetCharge)) printGrid(ns);
	else if (ns.stanek.acceptGift() && ns.stanek.activeFragments().length === 0) {
		setupGift(ns);
		await charge(ns, targetCharge);
	}
	else if (ns.stanek.acceptGift()) await charge(ns, targetCharge);
	else throw new Error('ERROR Failed to join the Church of the Machine God');
}

const CHARGE_SCRIPT = 'stanek/charge.js';
const MIN_TARGET_CHARGE = 200;
const MAX_TARGET_CHARGE = 9999;
const MAX_SLEEP = 32e3;

/** @param {NS} ns */
async function charge(ns, target) {
	//Logging
	ns.tail();
	ns.disableLog('scan');
	ns.disableLog('scp');
	ns.disableLog('exec');
	ns.disableLog('getServerMaxRam');
	ns.disableLog('getServerUsedRam');
	ns.disableLog('sleep');
	await ns.sleep(0);

	//Calculate target charge if it's not provided
	const targetCharge = target ?? Math.min(Math.max(Math.pow(ns.getServerMaxRam('home'), 0.9), MIN_TARGET_CHARGE), MAX_TARGET_CHARGE);

	//Declare variables
	const charging = [];
	let ramServers = [];
	let fragments = [];
	let averageCharge = 0;
	let selected;
	let freeRam = 0;
	let threads = 1;
	let tailHeight = 32;

	ns.atExit(() => charging.forEach(fragment => ns.kill(fragment.pid)));

	while (true) { //TODO: Add thread balancing if charge is not equal between frags
		//Kill existing processes
		while (charging.length > 0)
			ns.kill(charging[0].pid, charging.shift().host);

		//Update fragments data
		fragments = ns.stanek.activeFragments().filter(fragment => fragment.id < 100)// && fragment.numCharge < targetCharge);
		tailHeight = 32 + (fragments.length + 1) * 24
		ns.resizeTail(400, tailHeight);
		ns.moveTail(1557, 1118 - tailHeight);

		//Report average charge
		averageCharge = ns.stanek.activeFragments().reduce((sum, fragment) => sum + fragment.numCharge, 0) / fragments.length;
		for (const fragment of fragments) {
			ns.print(`Fragment ID ${fragment.id.toString().padStart(3)} : ${fragment.numCharge.toFixed(0)} / ${targetCharge}`);
		}
		ns.print(`Average charge is ${averageCharge.toFixed(0)}`);

		//Check if all fragments reached the target charge level
		if (fragments.every(fragment => fragment.numCharge >= targetCharge)) break;

		//Pick lowest charge
		fragments.sort((a, b) => a.numCharge - b.numCharge);
		selected = fragments[0];

		//Update host list
		ramServers = getServerList(ns, true, false).filter(server => ns.getServerMaxRam(server) > 0 && ns.hasRootAccess(server));

		//Start new chargers
		for (const server of ramServers) {
			freeRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
			threads = Math.floor(freeRam / 2);
			if (threads === 0) continue;
			ns.scp(CHARGE_SCRIPT, server, 'home');

			charging.push({
				host: server,
				pid: ns.exec(CHARGE_SCRIPT, server, threads, selected.x, selected.y)
			});
		}

		//Wait until it's ready
		while (selected.numCharge < targetCharge) {
			await ns.sleep(targetCharge * 10 + 100);
			selected = ns.stanek.getFragment(selected.x, selected.y); //Update charge info
		}
	}

	ns.print(`SUCCESS All fragments charged to ${targetCharge}`);
	tailHeight = 32 + (fragments.length + 3) * 24
	ns.resizeTail(400, tailHeight);
	ns.moveTail(1557, 1118 - tailHeight);
}

/** @param {NS} ns */
function report(ns) { //IMPORTANT: This is abandoned until a way to check fragment stat is added
	//╔═╗╚╝║╠╣╟╢╤╧╪─│┬┴┼▲▼■□
	//Possible width 9.735 * characters

	//Malloc
	const fragments = ns.stanek.activeFragments().sort((a, b) => a.id - b.id);
	let id = '00';
	let effect = 'ThisShallBeEffect';
	let bonus = '123.45%';
	let charge = '123.4k';

	//Header
	ns.print('╔════╤═════════════════╤═════════╤════════╗')
	ns.print('║ ID │   Effect Type   │  Bonus  │ Charge ║')
	ns.print('╟────┼─────────────────┼─────────┼────────╢')
	//Dynamic
	for (const fragment of fragments) {
		id = fragment.id.toString().padStart(2, ' ');
		//TODO: effect
		charge = ns.formatNumber(fragment.numCharge, 1).padStart(6, ' ');
	}
	ns.print(`║ 12 │ Faster Scripts  │ 123.45% │ 123.4k ║`)
	//Footer
	ns.print('╚════╧═════════════════╧═════════╧════════╝')
}

//-----------------------
//    <<GRID STUFF>>
//-----------------------

const PRESETS = {
	'HACK': {
		'6x5': [
			{ x: 0, y: 3, rotation: 0, id: 0 },
			{ x: 0, y: 1, rotation: 3, id: 1 },
			{ x: 3, y: 0, rotation: 0, id: 5 },
			{ x: 2, y: 4, rotation: 0, id: 6 },
			{ x: 0, y: 0, rotation: 2, id: 7 },
			{ x: 4, y: 1, rotation: 3, id: 25 },
			{ x: 2, y: 1, rotation: 0, id: 107 }
		],
		'6x6': [
			{ x: 3, y: 0, rotation: 2, id: 0 },
			{ x: 3, y: 3, rotation: 2, id: 1 },
			{ x: 0, y: 4, rotation: 2, id: 5 },
			{ x: 0, y: 1, rotation: 3, id: 6 },
			{ x: 2, y: 0, rotation: 1, id: 25 },
			{ x: 1, y: 0, rotation: 3, id: 101 },
			{ x: 2, y: 4, rotation: 2, id: 103 },
			{ x: 3, y: 1, rotation: 2, id: 106 }
		]
	}
}

/** @param {NS} ns */
function setupGift(ns) {
	const x = ns.stanek.giftWidth();
	const y = ns.stanek.giftHeight();
	const presetLoadedSuccessfully = loadPreset(ns, x, y);
	if (presetLoadedSuccessfully === false)
		throw new Error(`ERROR No preset available for a ${x}x${y} gift`);
}

/**
 * @param {number} x
 * @param {number} y
 * @param {'HACK'|'CRIME'|'BLADEBURNER'} type
 * @return {[{x:number,y:number,rotation:number,id:number}]}
 */
export function getPreset(x, y, type) {
	const key = x + 'x' + y;
	const preset = PRESETS[type][key];
	return preset ?? [];
}

/**
 * @param {NS} ns
 * @param {number} x
 * @param {number} y
 * @param {'HACK'|'CRIME'|'BLADEBURNER'} type
 * @return {boolean}
 */
export function loadPreset(ns, x, y, type = 'HACK') {
	const fragments = getPreset(x, y, type);
	if (fragments.length === 0) return false;
	for (const fragment of fragments)
		ns.stanek.placeFragment(fragment.x, fragment.y, fragment.rotation, fragment.id);
	return true;
}

/** @param {NS} ns */
export function resetGrid(ns) {
	const fragments = ns.stanek.activeFragments();
	for (const fragment of fragments)
		ns.stanek.removeFragment(fragment.x, fragment.y);
}

/** @param {NS} ns */
function printGrid(ns) {
	const fragments = ns.stanek.activeFragments().sort((a, b) => a.id - b.id);
	ns.tprint('Current Stanek\'s grid:')
	ns.tprintf(`${ns.stanek.giftWidth()}x${ns.stanek.giftHeight()}`);
	fragments.forEach(f => ns.tprintf(`{x: ${f.x}, y: ${f.y}, rotation: ${f.rotation}, id: ${f.id}},`));
}