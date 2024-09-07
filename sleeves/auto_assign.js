import { compactTail } from 'utils.js';
import { assignToFactionWork } from 'sleeves/assign_all.js'

/** @param {NS} ns */
export async function main(ns) {
	await colony(ns);
}

const SHOCK_THRESHOLD = 75;
const SYNC_THRESHOLD = 100;
const MIN_HOMICIDE_CHANCE = 0.2; // For Karma Homicide > Mug at 1 / 16 = (0.0625)
const GANG_KARMA_THRESHOLD = -54e3;
const SLEEP = 21e3;

let scriptName;

/** @param {NS} ns */
async function colony(ns) {
	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(0);
	//ns.moveTail(2022, 258);
	ns.moveTail(1957, 256);
	scriptName = ns.getScriptName();

	while (true) {
		const karma = ns.getPlayer().karma;
		for (let i = 0; i < ns.sleeve.getNumSleeves(); i++) {
			const sleeve = ns.sleeve.getSleeve(i);
			//Sync up
			if (sleeve.sync < SYNC_THRESHOLD)
				ns.sleeve.setToSynchronize(i);
			//Shock recovery
			else if (sleeve.shock > SHOCK_THRESHOLD || (sleeve.storedCycles > 10 && sleeve.shock > 0))
				ns.sleeve.setToShockRecovery(i);
			//Mug
			else if (karma > GANG_KARMA_THRESHOLD && ns.formulas.work.crimeSuccessChance(sleeve, 'Homicide') < MIN_HOMICIDE_CHANCE) {
				ns.sleeve.setToCommitCrime(i, "Mug");
			}
			//Homicide
			else if (karma > GANG_KARMA_THRESHOLD) {
				ns.sleeve.setToCommitCrime(i, "Homicide");
			}
			//Back to recovery if done with gang
			else if (sleeve.shock > 0)
				ns.sleeve.setToShockRecovery(i);
			//Augments
			else if (installAllAvailableAugments(ns, i) == false)
				assignToFactionWork(ns);
		}
		report(ns);
		await ns.sleep(SLEEP);
	}
}

/** 
 * @param {NS} ns
 * @param {number} sleeve 
 * @return {boolean}
 */
function installAllAvailableAugments(ns, sleeve) {
	let funds = ns.getPlayer().money;
	const augments = ns.sleeve.getSleevePurchasableAugs(sleeve);
	if (augments.length === 0) return false;
	augments.sort((a, b) => a.cost - b.cost);
	let bought = 0;
	for (const augment of augments) {
		if (augment.cost > funds) continue;
		ns.sleeve.purchaseSleeveAug(sleeve, augment.name);
		funds -= augment.cost;
		bought++;
	}
	return (bought > 0);
}

/** @param {NS} ns */
function report(ns) {
	//╔═╗╚╝║╟╢╤╧╪─│┬┴┼▲▼
	//Header
	ns.print('╔═══╤════════╤════════════════════╗');
	ns.print('║ N │  Shock │    Current Task    ║');
	ns.print('╟───┼────────┼────────────────────╢');
	//Dynamic
	const sleeveCount = ns.sleeve.getNumSleeves();
	for (let i = 0; i < sleeveCount; i++) {
		const sleeve = ns.sleeve.getSleeve(i);
		const shock = sleeve.shock.toFixed(1).padStart(5, ' ');
		let taskDescription = getTaskDescription(ns.sleeve.getTask(i));
		if (taskDescription.length > 18) taskDescription = taskDescription.split(' ')[0] + ' ...';
		const paddedDescription = taskDescription.padStart(Math.ceil((18 - taskDescription.length) / 2 + taskDescription.length), ' ').padEnd(18, ' ');
		ns.print(`║ ${i} │ ${shock}% │ ${paddedDescription} ║`);
	}
	//Footer
	ns.print('╚═══╧════════╧════════════════════╝');
	//Resizing
	ns.resizeTail(341, 16 * (6 + sleeveCount));
	compactTail(scriptName);
}

/**
 * @param {SleeveTask} task
 */
function getTaskDescription(task) {
	if (task === null) return 'Idle';
	switch (task.type) {
		case 'CLASS':
			return task.classType;
		case 'COMPANY':
			return task.companyName;
		case 'CRIME':
			return task.crimeType;
		case 'FACTION':
			return task.factionName;
		case 'INFILTRATE':
			return 'Infiltrating ' + task.location;
		case 'RECOVERY':
			return 'Shock Recovery';
		case 'SYNCHRO':
			return 'Synchronize';
		default:
			return 'ERROR';
	}
}

/** 
 * Alternative to `ns.formulas.work.crimeSuccessChance(sleeve, 'Homicide')`.
 * Skips some details but the result should be the same in the majority of cases.
 * @param {SleevePerson} sleeve 
 */
function getSleeveHomicideSuccessChance(sleeve) {
	return (sleeve.skills.strength * 2 + sleeve.skills.defense * 2 + sleeve.skills.dexterity * 0.5 + sleeve.skills.agility * 0.5 + sleeve.skills.intelligence * 0.025)
		/ 975
		* (1 + Math.pow(sleeve.skills.intelligence, 0.8) / 600)
		* sleeve.mults.crime_success;
}