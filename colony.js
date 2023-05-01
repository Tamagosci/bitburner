import { compactTail } from 'disease.js';

/** @param {NS} ns */
export async function main(ns) {
	if (ns.args[0] === undefined) await colony(ns);
	else assignAll(ns);
}

const SHOCK_THRESHOLD = 80;
const SYNC_THRESHOLD = 100;
const COMBINED_STATS_THRESHOLD = 400;
const GANG_KARMA_THRESHOLD = -54e3;
const SLEEP = 60e3;

let scriptName;
let hasGang = false;
let gangFaction;

/** @param {NS} ns */
async function colony(ns) {
	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(0);
	//ns.moveTail(2022, 258);
	ns.moveTail(1957, 258);

	scriptName = ns.getScriptName();

	while (true) {
		for (let i = 0; i < ns.sleeve.getNumSleeves(); i++) {
			const sleeve = ns.sleeve.getSleeve(i);
			//Sync up
			if (sleeve.sync < SYNC_THRESHOLD)
				ns.sleeve.setToSynchronize(i);
			//Shock recovery
			else if (sleeve.shock > SHOCK_THRESHOLD)
				ns.sleeve.setToShockRecovery(i);
			//Mug
			else if (sleeve.skills.strength + sleeve.skills.defense + sleeve.skills.dexterity + sleeve.skills.agility < COMBINED_STATS_THRESHOLD)
				ns.sleeve.setToCommitCrime(i, "Mug");
			//Homicide
			else if (ns.heart.break() > GANG_KARMA_THRESHOLD)
				ns.sleeve.setToCommitCrime(i, "Homicide");
			//Back to recovery if done with gang
			else if (sleeve.shock > 0 && ns.sleeve.getTask(i).crimeType === 'Homicide')
				ns.sleeve.setToShockRecovery(i);
			//Aguments
			if (!hasGang) {
				hasGang = ns.gang.inGang();
				if (hasGang) gangFaction = ns.gang.getGangInformation().faction;
			}
			else installAllAvailableAugments(ns, i);
		}
		report(ns);
		await ns.sleep(SLEEP);
	}
}

/**
 * @param {NS} ns
 * @param {string} objective
 */
function assignAll(ns) {
	let [typeOfWork, primary, secondary] = ns.args;
	let action = (i, p, s) => { return };
	switch (typeOfWork) {
		case 'bladeburner':
			action = (i, p, s) => { ns.sleeve.setToBladeburnerAction(i, p, s) };
			break;
		case 'crime':
			action = (i, p, s) => { ns.sleeve.setToCommitCrime(i, p) };
			break;
		case 'gym':
			action = (i, p, s) => { ns.sleeve.setToGymWorkout(i, p, s) };
			break;
		case 'idle':
			action = (i, p, s) => { ns.sleeve.setToIdle(i) };
			break;
		case 'shock':
			action = (i, p, s) => { ns.sleeve.setToShockRecovery(i) };
			break;
		case 'sync':
			action = (i, p, s) => { ns.sleeve.setToSynchronize(i) };
			break;
		case 'study':
			action = (i, p, s) => { ns.sleeve.setToUniversityCourse(i, p, s) };
			break;
		case 'travel':
			action = (i, p, s) => { ns.sleeve.travel(i, p) };
			break;
	}
	for (let i = 0; i < ns.sleeve.getNumSleeves(); i++)
		action(i, primary, secondary);
	report(ns);
}

/** 
 * @param {NS} ns
 * @param {number} sleeve 
 */
function installAllAvailableAugments(ns, sleeve) {
	const funds = ns.getPlayer().money;
	const augments = ns.sleeve.getSleevePurchasableAugs(sleeve);
	for (let i = 0; augments[i].cost < funds; i++) {
		ns.sleeve.purchaseSleeveAug(sleeve, augments[i].name);
		funds -= augments[i].cost;
	}
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
		const taskDescription = getTaskDescription(ns.sleeve.getTask(i));
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