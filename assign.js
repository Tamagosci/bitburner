/** @param {NS} ns */
export async function main(ns) {
	let [typeOfWork, primary, secondary] = ns.args;
	assign(ns, typeOfWork, primary, secondary);
}

const BEST_GYM = 'Powerhouse Gym';
const BEST_GYM_LOCATION = 'Sector-12';
const BEST_UNIVERSITY = 'ZB Institute of Technology';
const BEST_UNIVERSITY_LOCATION = 'Volhaven';

const TARGET_COMPANY_REP = 400e3;

/**
 * @param {NS} ns
 * @param {string} objective
 */
function assign(ns, typeOfWork, primary, secondary) {
	let action = (i, p, s) => { return true };
	switch (typeOfWork) {
		case 'bladeburner':
			action = (i, p, s) => { return ns.sleeve.setToBladeburnerAction(i, p, s) };
			break;
		case 'crime':
			action = (i, p, s) => { return ns.sleeve.setToCommitCrime(i, p) };
			break;
		case 'gym':
			if (primary === undefined)
				autoAssignToGym(ns);
			else
				action = (i, p, s) => { return ns.sleeve.travel(i, BEST_GYM_LOCATION) && ns.sleeve.setToGymWorkout(i, BEST_GYM, p) };
			break;
		case 'idle':
			action = (i, p, s) => { return ns.sleeve.setToIdle(i) };
			break;
		case 'shock':
			action = (i, p, s) => { return ns.sleeve.setToShockRecovery(i) };
			break;
		case 'sync':
			action = (i, p, s) => { return ns.sleeve.setToSynchronize(i) };
			break;
		case 'university':
		case 'uni':
		case 'study':
			if (primary === undefined)
				autoAssignToStudy(ns);
			else
				action = (i, p, s) => { return ns.sleeve.travel(i, BEST_UNIVERSITY_LOCATION) && ns.sleeve.setToUniversityCourse(i, BEST_UNIVERSITY, p) };
			break;
		case 'travel':
			action = (i, p, s) => { return ns.sleeve.travel(i, p) };
			break;
		case 'faction':
			assignToFactionWork(ns);
			return;
		case 'company':
		case 'work':
		case 'job':
			assignToCompanyWork(ns);
			return;
	}
	for (let i = 0; i < ns.sleeve.getNumSleeves(); i++)
		if (action(i, primary, secondary) === false) {
			ns.tprintf('ERROR Failed to assign sleeves.');
			break;
		}
}

/** @param {NS} ns */
function assignToFactionWork(ns) {
	//Get factions i can work for
	const myFactions = ns.getPlayer().factions.map(faction => ({
		name: faction,
		augments: ns.singularity.getAugmentationsFromFaction(faction).map(augment => ({
			name: augment,
			reputationReq: ns.singularity.getAugmentationRepReq(augment)
		}))
	}));
	//Filter out factions i don't need rep for
	const ownedAugments = ns.singularity.getOwnedAugmentations(true);
	const gangFaction = (ns.gang.inGang())
		? ns.gang.getGangInformation().faction
		: 'none';
	const factionsINeedReputationFor = myFactions.filter(faction =>
		faction.augments.some(augment => ownedAugments.includes(augment.name) === false)
		&& faction.name !== gangFaction
	);
	//Sort by ascending max aug cost
	factionsINeedReputationFor.sort((a, b) => Math.max(...a.augments.map(augment => augment.reputationReq)) - Math.max(...b.augments.map(augment => augment.reputationReq)));
	//Assign sleeves
	const howManyToAssign = Math.min(factionsINeedReputationFor.length, ns.sleeve.getNumSleeves());
	assign(ns, 'crime', 'mug');
	for (let i = 0; i < howManyToAssign; i++)
		if (ns.sleeve.setToFactionWork(i, factionsINeedReputationFor[i].name, 'field') === false)
			ns.sleeve.setToFactionWork(i, factionsINeedReputationFor[i].name, 'hacking');
}

/** @param {NS} ns */
function assignToCompanyWork(ns) {
	//Get jobs i can work for
	const myJobs = Object.keys(ns.getPlayer().jobs);
	//Filter out jobs i don't need rep for
	const jobsINeedReputationFor = myJobs
		.filter(job => ns.singularity.getCompanyRep(job) < TARGET_COMPANY_REP && ns.singularity.getCompanyFavor(job) < 150); //TODO: optimize better
	//Sort by ascending missing rep
	jobsINeedReputationFor.sort ((a, b) => 
		Math.max(TARGET_COMPANY_REP - ns.singularity.getCompanyRep(a), 0) - 
		Math.max(TARGET_COMPANY_REP - ns.singularity.getCompanyRep(b), 0));
	//['Business', 'Security', 'IT']
	//Assign sleeves
	const howManyToAssign = Math.min(jobsINeedReputationFor.length, ns.sleeve.getNumSleeves());
	assign(ns, 'crime', 'Deal Drugs');
	for (let i = 0; i < howManyToAssign; i++)
		ns.sleeve.setToCompanyWork(i, jobsINeedReputationFor[i]);
}

/** @param {NS} ns */
function autoAssignToGym(ns) {
	const classes = ['str', 'def', 'dex', 'agi'];
	for (let i = 0; i < ns.sleeve.getNumSleeves(); i++) {
		ns.sleeve.travel(i, BEST_GYM_LOCATION);
		ns.sleeve.setToGymWorkout(i, BEST_GYM, classes[i % classes.length]);
	}
}

/** @param {NS} ns */
function autoAssignToStudy(ns) {
	const classes = ['Algorithms', 'Leadership'];
	for (let i = 0; i < ns.sleeve.getNumSleeves(); i++) {
		ns.sleeve.travel(i, BEST_UNIVERSITY_LOCATION);
		ns.sleeve.setToGymWorkout(i, BEST_UNIVERSITY, classes[i % classes.length]);
	}
}
