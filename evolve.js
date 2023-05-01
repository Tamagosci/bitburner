import { backdoorTarget } from 'backdoor.js';
import { spread } from 'spread.js';

const CITY_FACTIONS = ['Sector-12', 'Aevum', 'Volhaven',
	'Chongqing', 'New Tokyo', 'Ishima'];
const US_FACTIONS = ['Sector-12', 'Aevum'];
const ASIA_FACTIONS = ['Chongqing', 'New Tokyo', 'Ishima'];
const EARLY_FACTIONS = ['Tian Di Hui', 'NetBurners'] //, 'Shadows of Anarchy']; //TODO: Find a way to automate
const LATE_FACTIONS = ['Daedalus', 'The Covenant', 'Illuminati'];
const HACK_FACTIONS = ['CyberSec', 'NiteSec', 'The Black Hand', 'BitRunners'];
const CRIME_FACTIONS = ['Slum Snakes', 'Shadows of Anarchy', 'Tetrads', 'Silhouette',
	'Speakers for the Dead', 'The Dark Army', 'The Syndicate'];
const CORPO_FACTIONS = ['ECorp', 'MegaCorp', 'Bachman & Associates',
	'Blade Industries', 'NWO', 'FourSigma', 'Clarke Incorporated',
	'OmniTek Incorporated', 'KuaiGong International', 'Fulcrum Secret Technologies'];

const HACK_PATH = ['Sector-12', 'CyberSec', 'Chongqing', 'Tian Di Hui',
	'NiteSec', 'The Black Hand', 'BitRunners'];
const CRIME_PATH = ['Aevum', 'Slum Snakes', 'Shadows of Anarchy', 'Sector-12', 'Ishima', 'New Tokyo', 
	'Volhaven', 'Tetrads', 'Speakers for the Dead', 'The Dark Army', 'The Syndicate'];
const CORPO_PATH = ['Sector-12', 'Aevum', 'Tian Di Hui', 'Fulcrum Secret Technologies', 'Bachman & Associates', 
	'Silhouette', 'NWO'];

const FACTION_JOBS = ['hacking', 'field', 'security'];
const COMPANY_JOBS = ['Agent', 'Business', 'IT', 'Software Consultant', 'Software', 'Security'];
const OBJECTIVES = ['hack', 'crime', 'corpo'];

const MAX_REP_COST = 465e3;
const CALLBACK = 'one.js'; //Callback needs rewrite
const NFG = 'NeuroFlux Governor';

let JOINED_FACTIONS = [];

/** @param {NS} ns */
export async function main(ns) {
	let [objective = 'hack', loop = true] = ns.args;
	switch (objective) {
		case 'help':
			ns.print('Usage: run evolve.js [help|info|hack|crime|corpo]=hack loop=true');
			return;
		case 'info':
			ns.printf('HACK: %s', findFactionByObjective('hack'));
			ns.printf('CRIME: %s', findFactionByObjective('crime'));
			ns.printf('CORPO: %s', findFactionByObjective('corpo'));
			return;
		default:
			await evolve(ns, objective, loop);
	}
}

/** 
 * @param {NS} ns 
 * @param {'hack'|'crime'|'corpo'} objective
 * @param {boolean} loop
 */
export async function evolve(ns, objective, loop) {
	//Check for compliance
	if (!OBJECTIVES.includes(objective)) return;

	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();

	//Setup
	const target = findFactionByObjective(ns, objective);
	if (target === 'none') return;
	const needFavor = shouldUnlockDonations(ns, target);
	const targetRep = (needFavor)
		? MAX_REP_COST
		: totalRepCost(ns, faction);
	let waitInvite = false;
	let joined = false;
	do {
		//Try to complete faction objectives
		if (!waitInvite)
			waitInvite = canGetInvited(ns, target); //TODO: Add proper logging
		//Wait for an invite
		else if (!joined)
			joined = await acceptInvite(ns, target);
		//Faction joined
		else {
			//Earn reputation
			if (ns.singularity.getFactionRep(faction) < targetRep) {
				//Use donations if possible	
				if (ns.singularity.getFactionFavor(faction) > 150)
					//Donate 10% of owned money until satisfied
					ns.singularity.donateToFaction(faction, ns.getServerMoneyAvailable('home') * 0.1);
				//Otherwise work for it
				else
					workForRep(ns, faction);
			}
			//Buy augments
			else if ((!needFavor && buyAllAugments(ns, faction)) || needFavor) {
				ns.killall('home', true);
				//Dump owned shares
				const stocks = ns.run('drain.js', 1, true);
				while (ns.isRunning(stocks)) await ns.sleep(6e3);
				//Buy as many NFG as possible
				while (ns.singularity.purchaseAugmentation(target, NFG));
				//Reset
				ns.singularity.installAugmentations(); //CALLBACK goes here
			}
		}
		//Avoid loop
		await ns.sleep(60e3);
	} while (loop);
}

/** 
 * @param {NS} ns 
 * @param {'hack'|'crime'|'corpo'} objective
 * @param {string} faction
 */
function findFactionByObjective(ns, objective) {
	const owned = ns.singularity.getOwnedAugmentations(true);
	//Early factions
	for (const faction of EARLY_FACTIONS)
		if (!ns.singularity.getAugmentationsFromFaction(faction).every(aug => owned.includes(aug)))
			return faction;
	//Objective factions
	switch (objective) {
		case 'hack':
			for (const faction of HACK_PATH)
				if (!ns.singularity.getAugmentationsFromFaction(faction).every(aug => owned.includes(aug)))
					return faction;
			break;
		case 'crime':
			for (const faction of CRIME_PATH)
				if (!ns.singularity.getAugmentationsFromFaction(faction).every(aug => owned.includes(aug)))
					return faction;
			break;
		case 'corpo':
			for (const faction of CORPO_PATH)
				if (!ns.singularity.getAugmentationsFromFaction(faction).every(aug => owned.includes(aug)))
					return faction;
			break;
	}
	//City factions
	for (const faction of CITY_FACTIONS)
		if (!ns.singularity.getAugmentationsFromFaction(faction).every(aug => owned.includes(aug)))
			return faction;
	//Late factions
	for (const faction of LATE_FACTIONS)
		if (!ns.singularity.getAugmentationsFromFaction(faction).every(aug => owned.includes(aug)))
			return faction;
	//Found nothing
	return 'none';
}

/** 
 * @param {NS} ns 
 * @param {string} faction
 * @return {boolean}
 */
function shouldUnlockDonations(ns, faction) {
	if (ns.singularity.getFactionFavor(faction) > 150) return false; //If we can already buy no need to unlock
	return (highestRepCost(ns, faction) > MAX_REP_COST);
}

/** 
 * @param {NS} ns 
 * @param {string} faction
 * @return {number}
 */
function highestRepCost(ns, faction) {
	const augments = ns.singularity.getAugmentationsFromFaction(faction);
	augments.sort((a, b) => ns.singularity.getAugmentationRepReq(b) - ns.singularity.getAugmentationRepReq(a));
	//Error check
	const highest = ns.singularity.getAugmentationRepReq(augments.shift());
	if (highest === undefined) {
		ns.printf('ERROR Something went wrong checking the rep requirements of %s.', faction);
		return 0;
	}
	else return highest;
}

/** 
 * @param {NS} ns 
 * @param {string} faction
 * @return {number}
 */
function totalRepCost(ns, faction) {
	const augments = ns.singularity.getAugmentationsFromFaction(faction);
	const owned = ns.singularity.getOwnedAugmentations(true);
	const needToBuy = augments.filter(augment => !owned.includes(augment));
	let totalCost = 0;
	for (const augment of needToBuy)
		totalCost += ns.singularity.getAugmentationRepReq(augment);
	return totalCost;
}

/** 
 * @param {NS} ns 
 * @param {string} faction
 */
function workForRep(ns, faction) {
	for (const job of FACTION_JOBS)
		if (ns.singularity.workForFaction(faction, job, false))
			return;
}

/** 
 * @param {NS} ns 
 * @param {string} faction
 * @return {boolean}
 */
function applyToCompany(ns, faction) {
	for (const job of COMPANY_JOBS)
		if (ns.singularity.applyToCompany(faction, job))
			return true;
	return false;
}

/** 
 * @param {NS} ns 
 * @param {string} faction
 * @return {boolean}
 */
function buyAllAugments(ns, faction) {
	const augments = ns.singularity.getAugmentationsFromFaction(faction);
	const owned = ns.singularity.getOwnedAugmentations(true);
	const needToBuy = augments.filter(augment => !owned.includes(augment) && augment != NFG);
	let boughtAll = true;
	for (const augment of needToBuy)
		if (!ns.singularity.purchaseAugmentation(faction, augment))
			boughtAll = false;
	return boughtAll;
}

/** 
 * This function tries to satisfy the conditions to join a specific faction.
 * @param {NS} ns 
 * @param {string} faction
 * @return {boolean} true if it completed the required tasks, false if they cannot be completed.
 */
function canGetInvited(ns, faction) { //TODO: Add logging
	//Skip if we already have the invitation
	if (ns.singularity.checkFactionInvitations().includes(faction)) return true;
	//Handle city factions
	if (CITY_FACTIONS.includes(faction)) {
		//They're all racist
		let goodToJoin = false;
		if (!hasJoinedAny(CITY_FACTIONS))
			goodToJoin = true;
		else if (hasJoinedAny(US_FACTIONS) && US_FACTIONS.includes(faction))
			goodToJoin = true;
		else if (hasJoinedAny(ASIA_FACTIONS) && ASIA_FACTIONS.includes(faction))
			goodToJoin = true;
		//Let's take a plane
		if (goodToJoin && ns.singularity.travelToCity(faction))
			return (ns.getServerMoneyAvailable('home') >= 50e6); // Volhaven has the highest requirements at 50m
		else
			return false;
	}
	//Handle early factions
	if (EARLY_FACTIONS.includes(faction)) {
		switch (faction) {
			case 'Tian Di Hui':
				if (ns.singularity.travelToCity('Ishima'))
					return (ns.getServerMoneyAvailable('home') >= 1e6 && ns.getHackingLevel() >= 50);
				else return false;
			case 'Netburners':
				return (ns.run('hacknet.js', 1, 1) != 0);
			case 'Shadows of Anarchy':
				//TODO: infiltrate any company
				return false;
			default:
				return false;
		}
	}
	//Handle hack factions
	if (HACK_FACTIONS.includes(faction)) {
		spread(ns);
		switch (faction) {
			case 'CyberSec':
				return tryBackdooring(ns, 'CSEC');
			case 'NiteSec':
				return tryBackdooring(ns, 'avmnite-02h');
			case 'The Black Hand':
				return tryBackdooring(ns, 'I.I.I.I');
			case 'BitRunners':
				return tryBackdooring(ns, 'run4theh111z');
			default:
				return false;
		}
	}
	//Handle corporate factions
	if (CORPO_FACTIONS.includes(faction)) {
		if (faction === 'Fulcrum Secret Technologies') {
			ns.tprint('ERROR You need to manually backdoor the server fulcrumassets to join FST.\n'*3);
			if (applyToCompany(ns, 'Fulcrum Technologies') && ns.singularity.workForCompany('Fulcrum Technologies', false))
				return (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel('fulcrumassets'));
			else return false;	
		}
		else
			return (applyToCompany(ns, faction) && ns.singularity.workForCompany(faction, false));
	}
	//Handle crime factions
	if (CRIME_FACTIONS.includes(faction)) {
		switch (faction) {
			case 'Silhouette': //TODO: Company
				return false;
			case 'Slum Snakes':
				if (ns.singularity.commitCrime('Mug', false) > 0)
					return (ns.getServerMoneyAvailable('home') >= 1e6 && getLowestCombatStat(ns) >= 30);
			case 'Tetrads':
				if (ns.singularity.travelToCity('Ishima') && ns.singularity.commitCrime('Mug', false))
					return (getLowestCombatStat(ns) >= 75);
			case 'Speakers for the Dead':
				if (ns.singularity.commitCrime('Homicide', false))
					return (ns.getHackingLevel() >= 100 && getLowestCombatStat(ns) >= 300);
			case 'The Dark Army':
				if (ns.singularity.travelToCity('Chongqing') && ns.singularity.commitCrime('Homicide', false))
					return (ns.getHackingLevel() >= 300 && getLowestCombatStat(ns) >= 300);
			case 'The Syndicate':
				if (ns.singularity.travelToCity('Sector-12') && ns.singularity.commitCrime('Homicide', false))
					return (ns.getHackingLevel() >= 200 && getLowestCombatStat(ns) >= 200);
		}
	}
	//Handle late factions
	if (LATE_FACTIONS.includes(faction)) {
		switch (faction) {
			case 'The Covenant':
				return (ns.singularity.getOwnedAugmentations().length >= 20)
					&& (ns.getHackingLevel() > 850 && getLowestCombatStat(ns) > 850)
					&& (ns.getServerMoneyAvailable('home') >= 75e9);
			case 'Daedalus':
				return (ns.singularity.getOwnedAugmentations().length >= 30)
					&& (ns.getHackingLevel() >= 2500 || getLowestCombatStat(ns) >= 1500)
					&& (ns.getServerMoneyAvailable('home') >= 100e9);
				return true;
			case 'Illuminati':
				return (ns.singularity.getOwnedAugmentations().length >= 30)
					&& (ns.getHackingLevel() >= 1500 && getLowestCombatStat(ns) >= 1200)
					&& (ns.getServerMoneyAvailable('home') >= 150e9);
			default:
				return false;
		}
	}
	//When in doubt, it failed
	return false;
}

/**
 * @param {NS} ns
 * @param {string} faction
 */
async function acceptInvite(ns, faction) {
	while (!ns.singularity.checkFactionInvitations().includes(faction))
		await ns.sleep(60e3);
	return ns.singularity.joinFaction(faction);
}

/**
 * @param {string[]} factions
 * @return {boolean}
 */
function hasJoinedAny(factions) {
	for (const faction of factions)
		if (JOINED_FACTIONS.includes(faction))
			return true;
	return false;
}

/**
 * @param {NS} ns
 * @param {string} target
 * @return {boolean}
 */
async function tryBackdooring(ns, target) {
	if (ns.hasRootAccess(target) && ns.getServerRequiredHackingLevel(target) >= ns.getHackingLevel())
		return backdoorTarget(ns, target);
	else return false;
}

/**
 * @param {NS} ns
 * @return {number}
 */
function getLowestCombatStat(ns) {
	const skills = ns.getPlayer().skills;
	return Math.min(skills.strength, skills.defense, skills.dexterity, skills.agility);
}