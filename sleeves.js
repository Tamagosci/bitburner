import { compactTail } from 'utils.js';

/** @param {NS} ns */
export async function main(ns) {
	await colony(ns);
}

const SHOCK_THRESHOLD = 80;
const SYNC_THRESHOLD = 100;
const COMBINED_STATS_THRESHOLD = 600;
const GANG_KARMA_THRESHOLD = -54e3;
const SLEEP = 40e3;

let scriptName;

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
			else if (sleeve.shock > SHOCK_THRESHOLD || (sleeve.storedCycles > 10 && sleeve.shock > 0))
				ns.sleeve.setToShockRecovery(i);
			//Mug
			else if (sleeve.skills.strength + sleeve.skills.defense + sleeve.skills.dexterity + sleeve.skills.agility < COMBINED_STATS_THRESHOLD
				&& ns.heart.break() > GANG_KARMA_THRESHOLD)
				ns.sleeve.setToCommitCrime(i, "Mug");
			//Homicide
			else if (ns.heart.break() > GANG_KARMA_THRESHOLD)
				ns.sleeve.setToCommitCrime(i, "Homicide");
			//Back to recovery if done with gang
			else if (sleeve.shock > 0)
				ns.sleeve.setToShockRecovery(i);
			//Aguments
			installAllAvailableAugments(ns, i);
		}
		report(ns);
		await ns.sleep(SLEEP);
	}
}

/** 
 * @param {NS} ns
 * @param {number} sleeve 
 */
function installAllAvailableAugments(ns, sleeve) {
	let funds = ns.getPlayer().money;
	const augments = ns.sleeve.getSleevePurchasableAugs(sleeve);
	augments.sort((a, b) => a.cost - b.cost);
	for (const augment of augments) {
		if (augment.cost > funds) continue;
		ns.sleeve.purchaseSleeveAug(sleeve, augment.name);
		funds -= augment.cost;
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