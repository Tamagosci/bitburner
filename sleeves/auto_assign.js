import { compactTail } from 'utils.js';

/** @param {NS} ns */
export async function main(ns) {
	await autoAssignSleeves(ns);
}

// NOTE:
// Sleeves without bonus time update 1 time every 200ms, or 5 times per second
// Sleeves with bonus time update 15 times every 200ms, or 75 times per second
// 1 / 75 = 13.3

const SHOCK_THRESHOLD = 90; // 0-100, suggested around 70-90
const SYNC_THRESHOLD = 100;
const MIN_HOMICIDE_CHANCE = 0.2; // For Karma Homicide > Mug at 1 / 16 = (0.0625)
const GANG_KARMA_THRESHOLD = -54e3;
const SLEEP = 60500;

let scriptName;

/** @param {NS} ns */
async function autoAssignSleeves(ns) {
	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(0);
	//ns.moveTail(2022, 258);
	ns.moveTail(1957, 256);
	scriptName = ns.getScriptName();

	let sleeveChosenForInfiltration = Math.floor(Math.random() * ns.sleeve.getNumSleeves());

	while (true) {
		const joinedBladeburner = ns.bladeburner.inBladeburner();
		const factionsINeedReputationFor = getFactionsINeedRepFor(ns);
		const companiesINeedReputationFor = getCompaniesINeedRepFor(ns);
		const karma = ns.getPlayer().karma;
		const sleeveAmount = ns.sleeve.getNumSleeves();

		for (let sleeveNumber = 0; sleeveNumber < sleeveAmount; ns.sleeve.setToIdle(sleeveNumber++));

		for (let sleeveNumber = 0; sleeveNumber < sleeveAmount; sleeveNumber++) {
			const sleeve = ns.sleeve.getSleeve(sleeveNumber);
			// Sync up
			if (sleeve.sync < SYNC_THRESHOLD)
				ns.sleeve.setToSynchronize(sleeveNumber);
			// Shock recovery
			else if (sleeve.shock > SHOCK_THRESHOLD || (sleeve.storedCycles > 15 && sleeve.shock > 0))
				ns.sleeve.setToShockRecovery(sleeveNumber);
			// Could use help in bladeburner
			else if (sleeveNumber === sleeveChosenForInfiltration && joinedBladeburner && (sleeve.storedCycles < 15 || sleeve.storedCycles > SLEEP / 13.3)) // Bonus time sleeve updates 75 times /s
				ns.sleeve.setToBladeburnerAction(sleeveNumber, 'Infiltrate Synthoids'); //TODO: Might want to move this up one
			// Need faction rep
			else if (factionsINeedReputationFor.length > 0)
				assignSleeveToFactionWork(ns, sleeveNumber, factionsINeedReputationFor.shift());
			// Mug
			else if (karma > GANG_KARMA_THRESHOLD && ns.formulas.work.crimeSuccessChance(sleeve, 'Homicide') < MIN_HOMICIDE_CHANCE)
				ns.sleeve.setToCommitCrime(sleeveNumber, "Mug");
			// Homicide
			else if (karma > GANG_KARMA_THRESHOLD)
				ns.sleeve.setToCommitCrime(sleeveNumber, "Homicide");
			// Need company rep
			else if (companiesINeedReputationFor.length > 0)
				ns.sleeve.setToCompanyWork(sleeveNumber, companiesINeedReputationFor.shift());
			// Back to recovery if nothing else to do
			else if (sleeve.shock > 0)
				ns.sleeve.setToShockRecovery(sleeveNumber);
			// Nothing to do
			else
				ns.sleeve.setToIdle(sleeveNumber);
			
			// Purchase and install augments
			if (sleeve.shock === 0)
				installAllAvailableAugments(ns, sleeveNumber);
		}

		// Cycle which one infiltrates so that after everything else is done they abuse stored cycles
		sleeveChosenForInfiltration++;
		if (sleeveChosenForInfiltration >= sleeveAmount) sleeveChosenForInfiltration = 0;
		
		report(ns);
		await ns.sleep(SLEEP);
	}
}

/** 
 * @param {NS} ns
 * @param {number} sleeveNumber 
 * @return {boolean}
 */
function installAllAvailableAugments(ns, sleeveNumber) {
	let funds = ns.getPlayer().money;
	let boughtAny = false;
	const augments = ns.sleeve.getSleevePurchasableAugs(sleeveNumber);
	if (augments.length === 0) return true;
	augments.sort((a, b) => a.cost - b.cost); //Ascending cost order
	for (const augment of augments) {
		if (augment.cost > funds) break;
		ns.sleeve.purchaseSleeveAug(sleeveNumber, augment.name);
		funds -= augment.cost;
		boughtAny = true;
	}
	return boughtAny;
}

/** 
 * Alternative to `ns.formulas.work.crimeSuccessChance(sleeve, 'Homicide')`.
 * Skips some details but the result should be the same in the majority of cases.
 * @param {SleevePerson} sleeve 
 */
function getSleeveHomicideSuccessChance(sleeve, nodeCrimeSuccessMultiplier = 1) {
	return (sleeve.skills.strength * 2 + sleeve.skills.defense * 2 + sleeve.skills.dexterity * 0.5 + sleeve.skills.agility * 0.5 + sleeve.skills.intelligence * 0.025)
		/ 975
		* (1 + Math.pow(sleeve.skills.intelligence, 0.8) / 600)
		* sleeve.mults.crime_success
		* nodeCrimeSuccessMultiplier;
}

/**
 * @param {NS} ns
 * @return {string[]}
 */
function getFactionsINeedRepFor(ns) {
	const blacklistedFactions = ['Bladeburners', 'Church of the Machine God'];
	if (ns.gang.inGang()) blacklistedFactions.push(ns.gang.getGangInformation().faction);
	//Get factions i can work for
	let myFactions = ns.getPlayer().factions
		.filter(faction => !blacklistedFactions.includes(faction))
		.map(faction => ({
			name: faction,
			rep: ns.singularity.getFactionRep(faction),
			augments: ns.singularity.getAugmentationsFromFaction(faction).map(augment => ({
				name: augment,
				reputationReq: ns.singularity.getAugmentationRepReq(augment)
			}))
		}));
	//Filter out factions i don't need rep for
	const ownedAugments = ns.singularity.getOwnedAugmentations(true);
	
	//Has augments I am missing that I can't purchase with current rep
	const factionsINeedReputationFor = myFactions.filter(faction =>
		faction.augments.some(augment => !ownedAugments.includes(augment.name) && faction.rep < augment.reputationReq)
	);
	//Sort by ascending max aug cost aka work for those which take less time first
	factionsINeedReputationFor.sort((a, b) => Math.max(...a.augments.map(augment => augment.reputationReq)) - Math.max(...b.augments.map(augment => augment.reputationReq)));
	return factionsINeedReputationFor.map(faction => faction.name);
}

/**
 * @param {NS} ns
 * @return {string[]}
 */
function getCompaniesINeedRepFor(ns) {
	return Object.keys(ns.getPlayer().jobs)
		.map(companyName => ({name: companyName, reputation: ns.singularity.getCompanyRep(companyName)}))
		.filter(job => job.reputation < 400e3)
		.sort((job1, job2) => job2.reputation - job1.reputation)
		.map(company => company.name);
		//.filter((value, index, list) => list.indexOf(value) === index)
}

/**
 * @param {NS} ns
 * @param {number} sleeveNum
 * @param {string} factionName
 */
function assignSleeveToFactionWork(ns, sleeveNum, factionName) {
	if (!ns.sleeve.setToFactionWork(sleeveNum, factionName, 'field'))
		if (!ns.sleeve.setToFactionWork(sleeveNum, factionName, 'security'))
			ns.sleeve.setToFactionWork(sleeveNum, factionName, 'hacking');
}

/** @param {NS} ns */
function report(ns) {
	//╔═╗╚╝║╟╢╤╧╪─│┬┴┼▲▼
	//Header
	ns.print('╔═══╤════════════════════════════╗');
	ns.print('║ N │        Current Task        ║');
	ns.print('╟───┼────────────────────────────╢');
	//Dynamic
	const sleeveCount = ns.sleeve.getNumSleeves();
	for (let i = 0; i < sleeveCount; i++) {
		const sleeve = ns.sleeve.getSleeve(i);
		let taskDescription = getTaskDescription(ns.sleeve.getTask(i));
		if (taskDescription.length > 26) taskDescription = taskDescription.split(' ')[0] + ' ...';
		const paddedDescription = taskDescription.padStart(Math.round((26 - taskDescription.length) / 2 + taskDescription.length), ' ').padEnd(26, ' ');
		ns.print(`║ ${i} │ ${paddedDescription} ║`);
	}
	//Footer
	ns.print('╚═══╧════════════════════════════╝');
	//Resizing
	ns.resizeTail(330, 16 * (6 + sleeveCount));
	compactTail(scriptName);
}

/**
 * @param {SleeveTask} task
 * @return {string}
 */
function getTaskDescription(task) {
	if (task === null) return 'Idle';
	switch (task.type) {
		case 'BLADEBURNER':
			return 'Bladeburner ' + task.actionName;
		case 'CLASS':
			return task.classType;
		case 'COMPANY':
			return task.companyName;
		case 'CRIME':
			return task.crimeType;
		case 'FACTION':
			return task.factionName;
		case 'INFILTRATE':
			return 'Infiltrating Synthoids';
		case 'RECOVERY':
			return 'Shock Recovery';
		case 'SYNCHRO':
			return 'Synchronizing';
		default:
			return 'ERROR';
	}
}