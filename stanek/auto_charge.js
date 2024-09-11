import { getServerList, compactTail } from 'utils.js';

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
const MIN_TARGET_CHARGE = 20;
const MAX_TARGET_CHARGE = 6000; //Currently included in the math logic

/** @param {NS} ns */
async function charge(ns, target) {
	//Logging
	ns.tail();
	ns.disableLog('ALL');
	//ns.disableLog()
	await ns.sleep(0);

	//Calculate target charge if it's not provided
	const targetCharge = target ?? Math.max(Math.log2(ns.getServer('home').maxRam) * 200, MIN_TARGET_CHARGE)

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
		tailHeight = 32 + (fragments.length + 4) * 16
		ns.moveTail(1424, 1118 - tailHeight);

		//Report 
		report(ns);
		//averageCharge = ns.stanek.activeFragments().reduce((sum, fragment) => sum + fragment.numCharge, 0) / fragments.length;

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
			report(ns);
			await ns.sleep(1e3);
			selected = ns.stanek.getFragment(selected.x, selected.y); //Update charge info
		}
	}

	//ns.print(`SUCCESS All fragments charged to ${targetCharge}`);
	tailHeight = 32 + (fragments.length + 5) * 16
	ns.resizeTail(533, tailHeight)
	ns.moveTail(1424, 1118 - tailHeight)
	compactTail(ns.getScriptName())
}

//-----------------------
//    <<GRAPHICS>>
//-----------------------

/** @param {NS} ns */
function report(ns) { //IMPORTANT: This is abandoned until a way to check fragment stat is added
	//╔═╗╚╝║╠╣╟╢╤╧╪─│┬┴┼▲▼■□
	//Possible width 9.735 * characters

	//Malloc
	const fragments = ns.stanek.activeFragments().filter(frag => frag.id < 100).sort((a, b) => a.id - b.id);

	//Header
	ns.print('╔════╤═════════════════════════════╤═════════╤════════╗')
	ns.print('║ ID │         Effect Type         │  Bonus  │ Charge ║')
	ns.print('╟────┼─────────────────────────────┼─────────┼────────╢')
	//Dynamic
	for (const fragment of fragments) {
		const id = fragment.id.toString().padStart(2, ' ')
		//TODO: effect
		const effect = getFragmentEffect(fragment.id).padEnd(27, ' ')
		const bonusValue = calculateFragmentBonus(ns, fragment.id)
		const bonus = ns.formatPercent(bonusValue - 1, 1).padStart(7, ' ')
		const charge = ns.formatNumber(fragment.numCharge, 1).padStart(6, ' ')
		ns.print(`║ ${id} │ ${effect} │ ${bonus} │ ${charge} ║`)
	}
	//Example line
	//ns.print(`║ 12 │ Faster Scripts  │ 123.45% │ 123.4k ║`)
	//Footer
	ns.print('╚════╧═════════════════════════════╧═════════╧════════╝')

	//Resize
	
	ns.resizeTail(533, 32 + (fragments.length + 4) * 16)
	compactTail(ns.getScriptName())
}

/**
 * @param {number} id
 * @return {string}
 */
function getFragmentEffect(id) {
	switch (id) {
		case 0:
		case 1:
			return 'Hacking exp and skill level'
		case 5:
			return 'Faster hack/grow/weaken'
		case 6:
			return 'hack() power'
		case 7:
			return 'grow() power'
		case 25:
			return 'Reputation gained'
		default:
			return 'ID not implemented'
	}
}

/**
 * @param {NS} ns
 * @param {number} id
 */
function calculateFragmentBonus(ns, id) {
	const nodeMultiplier = ns.getBitNodeMultipliers().StaneksGiftPowerMultiplier
	const fragmentDefinitions = ns.stanek.fragmentDefinitions()
	const fragmentDefinitionData = fragmentDefinitions.find(fragment => fragment.id === id)
	const fragmentData = ns.stanek.activeFragments().find(fragment => fragment.id === id)
	const boost = 1; //calculateBoost(ns, id)
	return calculateBonus(fragmentData.highestCharge, fragmentData.numCharge, fragmentDefinitionData.power, boost, nodeMultiplier)
}

/**
 * @param {number} highestCharge
 * @param {number} numCharge
 * @param {number} power
 * @param {number} boost
 * @param {number} nodeMultiplier
 * @return {number}
 */
function calculateBonus(highestCharge = 0, numCharge = 0, power = 1, boost = 1, nodeMultiplier = 1) {
  return (
    1 +
    (Math.log(highestCharge + 1) / 60) *
      Math.pow((numCharge + 1) / 5, 0.07) *
      power *
      boost *
      nodeMultiplier
  );
}

/**
 * @param {NS} ns
 * @param {number} id
 */
function calculateBoost(ns, id) {
	const width = ns.stanek.giftWidth()
	const height = ns.stanek.giftHeight()

	const occupiedCoords = []
	for (let x = 0; x < width; x++)
		for (let y = 0; y < height; y++)
			if (ns.stanek.getFragment(x, y)?.id === id)
				occupiedCoords.concat(new Coordinate(x, y))
	ns.print(`Occupied ${occupiedCoords}`)

	const neighbourCoords = [];
	occupiedCoords.forEach(coord => {
		neighbourCoords.concat(new Coordinate(coord.x, coord.y+1))
		neighbourCoords.concat(new Coordinate(coord.x, coord.y-1))
		neighbourCoords.concat(new Coordinate(coord.x+1, coord.y))
		neighbourCoords.concat(new Coordinate(coord.x-1, coord.y))
	})

	const boost = neighbourCoords
		.map(coords => ns.stanek.getFragment(coords.x, coords.y))
		.filter((coord, index, array) => array.indexOf(coord) === index) //Remove duplicates
		.filter(fragment => fragment !== undefined)
		.filter(fragment => fragment?.id ?? 0 >= 100)
		.reduce((boost, fragment) => boost * fragmentDefinitions.find(f => f.id === fragment.id).power, 1)
	
	return boost;
}

class Coordinate {
	constructor(x, y) {
		this.x = x
		this.y = y
	}

	equals(object) {
		if (typeof object !== typeof this) return false
		return object.x === this.x && object.y === this.y
	}

	toString() {
		return `{x: ${this.x}, y: ${this.y}}`
	}
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