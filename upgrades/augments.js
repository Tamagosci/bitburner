import { formatTime } from 'utils.js';
import { backdoorTarget } from 'servers/backdoor.js';
import { spread } from 'servers/infect_all.js';

const CITY_FACTIONS = ['Sector-12', 'Aevum', 'Volhaven',
	'Chongqing', 'New Tokyo', 'Ishima'];
const US_FACTIONS = ['Sector-12', 'Aevum'];
const ASIA_FACTIONS = ['Chongqing', 'New Tokyo', 'Ishima'];
const EARLY_FACTIONS = ['Tian Di Hui', 'Netburners'] //, 'Shadows of Anarchy']; //TODO: Find a way to automate
const LATE_FACTIONS = ['Daedalus', 'The Covenant', 'Illuminati'];
const HACK_FACTIONS = ['CyberSec', 'NiteSec', 'The Black Hand', 'BitRunners'];
const CRIME_FACTIONS = ['Slum Snakes', 'Shadows of Anarchy', 'Tetrads', 'Silhouette',
	'Speakers for the Dead', 'The Dark Army', 'The Syndicate'];
const CORPO_FACTIONS = ['ECorp', 'MegaCorp', 'Bachman & Associates',
	'Blade Industries', 'NWO', 'FourSigma', 'Clarke Incorporated',
	'OmniTek Incorporated', 'KuaiGong International', 'Fulcrum Secret Technologies'];

const HACK_PATH = ['Sector-12', 'CyberSec', 'Chongqing', 'Tian Di Hui',
	'NiteSec', 'The Black Hand', 'BitRunners'];
const CRIME_PATH = ['Aevum', 'Slum Snakes', 'Sector-12', 'Ishima', 'New Tokyo', 
	'Volhaven', 'Tetrads', 'Speakers for the Dead', 'The Dark Army', 'The Syndicate']; //, 'Shadows of Anarchy' would go after slum snakes
const CORPO_PATH = ['Sector-12', 'Aevum', 'Tian Di Hui', 'Fulcrum Secret Technologies', 'Bachman & Associates', 
	'Silhouette', 'NWO'];

const FACTION_BLACKLIST = ['Shadows of Anarchy', 'Church of the Machine God', 'Slum Snakes'];

const FACTION_JOBS = ['hacking', 'field', 'security'];
const COMPANY_JOBS = ['Agent', 'Business', 'IT', 'Software Consultant', 'Software', 'Security'];
const OBJECTIVES = ['hack', 'crime', 'corpo'];

const MAX_REP_COST = 465e3;
const CALLBACK = 'auto_start.js';
const NFG = 'NeuroFlux Governor';

/** @param {NS} ns */
export async function main(ns) {
	let [objective = 'hack', loop = true] = ns.args;
	switch (objective) {
		case 'help':
			ns.print('Usage: run join_factions.js [help|info|hack|crime|corpo]=hack loop=true');
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
	await ns.sleep(0);
	ns.moveTail(1957, 28);
	ns.resizeTail(341, 228);

	//Setup
	let targetFaction = findFactionByObjective(ns, objective);
	if (targetFaction === 'none') {
		ns.print(`INFO Completed all factions related to ${objective}, attempting other objectives`);
		for (const secondaryObjective of OBJECTIVES) {
			targetFaction = findFactionByObjective(ns, secondaryObjective);
			if (targetFaction !== 'none') break;
		}
		if (targetFaction === 'none') {
			ns.print(`Completed all factions, shutting script down.`);
			await ns.sleep(10e3);
			ns.closeTail();
			ns.kill(ns.pid);
		}
	}
	ns.print(`INFO Targeting faction ${targetFaction}`);
	const needFavor = shouldUnlockDonations(ns, targetFaction);
	const targetRep = (needFavor)
		? MAX_REP_COST
		: totalRepCost(ns, targetFaction);
	ns.print(`INFO Targeting reputation ${ns.formatNumber(targetRep, 0, 10e3)}`);
	let waitInvite;
	let joined = waitInvite = ns.getPlayer().factions.includes(targetFaction);
	if (joined) ns.print(`Player already joined ${targetFaction}`);
	do {
		//Try to complete faction objectives
		if (!waitInvite) {
			waitInvite = await canGetInvited(ns, targetFaction);
			if (!waitInvite) ns.print('Waiting for conditions to join');
			else {
				ns.print('Conditions to join satisfied');
				await ns.sleep(10e3);
				continue;
			}
		}
		//Wait for an invite
		else if (!joined) {
			ns.print('Waiting for faction invite');
			joined = await acceptInvite(ns, targetFaction);
			if (joined) {
				ns.print(`SUCCESS Joined faction ${targetFaction}`);
				continue;
			}
		}
		//Faction joined
		else {
			joinPendingFactions(ns)
			ns.run('factions/bribe.js');
			await ns.sleep(1e3);
			const factionRep = ns.singularity.getFactionRep(targetFaction)
			//Earn reputation
			if (factionRep < targetRep) {
				ns.print(`Current reputation ${ns.formatNumber(factionRep, 1, 1e3)} / ${ns.formatNumber(targetRep, 1, 1e3)}`);
				//Use donations if possible	
				if (ns.singularity.getFactionFavor(targetFaction) > 150) {
					//Donate 10% of owned money until satisfied
					const moneyToDonate = ns.getServerMoneyAvailable('home') * 0.1
					ns.singularity.donateToFaction(targetFaction, moneyToDonate);
					ns.print(`Donated ${ns.formatNumber(moneyToDonate, 1)} dollars to ${targetFaction} for favor`);
				}
				//Otherwise work for it
				else
					workForRep(ns, targetFaction);
			}
			//Buy augments
			else if ((!needFavor && buyAllAugmentsPriority(ns, targetFaction)) || needFavor) {
				buyAllAugmentsPriority(ns, targetFaction);
				if (ns.singularity.getOwnedAugmentations(true) > ns.singularity.getOwnedAugmentations(false)) {
					ns.print('WARN About to install augments!');
					ns.killall('home', true);
					//Wait for script to finish selling stocks
					await ns.sleep(3e3);
					//Buy as many NFG as possible
					while (ns.singularity.purchaseAugmentation(targetFaction, NFG));
					//Reset
					ns.singularity.installAugmentations(CALLBACK);
				}
				else if (needFavor) ns.print('WARN Failed to restart for favor due to lack of augments');
			}
			else ns.print(`Waiting for money... (${formatTime(Math.floor(ns.getRunningScript().onlineRunningTime)*1000)})`);
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
	//Early factions
	for (const faction of EARLY_FACTIONS)
		if (!ns.singularity.getAugmentationsFromFaction(faction).every(aug => owned.includes(aug)))
			return faction;
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
	augments.filter(augment => augment !== NFG)
			.sort((a, b) => ns.singularity.getAugmentationRepReq(b) - ns.singularity.getAugmentationRepReq(a));
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
	const prices = needToBuy.map(augment => ns.singularity.getAugmentationRepReq(augment));
	return Math.max(...prices);
}

/** 
 * @param {NS} ns 
 * @param {string} faction
 */
function workForRep(ns, faction) {
	let chosenJob;
	for (const job of FACTION_JOBS)
		if (ns.singularity.workForFaction(faction, job, false)) {
			chosenJob = job;
			break;
		}
	ns.print(`Started doing ${chosenJob} for ${faction}`);
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
function buyAugments(ns, faction) {
	const augments = ns.singularity.getAugmentationsFromFaction(faction);
	const owned = ns.singularity.getOwnedAugmentations(true);
	const needToBuy = augments
		.filter(augment => !owned.includes(augment) && augment != NFG)
		.sort((a, b) => ns.singularity.getAugmentationPrice(b) - ns.singularity.getAugmentationPrice(a));
	if (needToBuy.length === 0) return true;
	ns.print(`Need to buy ${needToBuy.length} augments from ${faction}`);
	let boughtAll = true;
	let missingAugments = needToBuy.length;
	for (const augment of needToBuy) {
		if (ns.singularity.purchaseAugmentation(faction, augment)) {
			ns.print(`Bought ${augment}\n  from ${faction}`);
			missingAugments--;
		}
		else {
			boughtAll = false;
			break;
		}
	}
	if (missingAugments > 0)
		ns.print(`Missing ${missingAugments} augments with ${faction}`);
	return boughtAll;
}

/** 
 * @param {NS} ns 
 * @param {string} priorityFaction
 * @return {boolean}
 */
function buyAllAugmentsPriority(ns, priorityFaction) {
	const joinedFactions = ns.getPlayer().factions;
	const result = buyAugments(ns, priorityFaction);  //Buy augments for target faction
	if (result)  //If there is extra money buy from other factions too
		for (const faction of joinedFactions)
			buyAugments(ns, faction);
	return result;
}

/** 
 * @param {NS} ns 
 * @param {string} priorityFaction
 * @return {number}
 */
function buyMostExpensiveAugments(ns) {
	const joinedFactions = ns.getPlayer().factions;
	const boughtCounter = 0;
	const owned = ns.singularity.getOwnedAugmentations(true);
	const cartNamesOnly = [];
	const cart = [];
	//Save which augments you can purchase
	for (const faction of joinedFactions) {
		const augments = ns.singularity.getAugmentationsFromFaction(faction);
		const addToCart = augments
		.filter(augment => !owned.includes(augment) && !cartNamesOnly.includes(augment) && augment != NFG)
		.sort((a, b) => ns.singularity.getAugmentationPrice(b) - ns.singularity.getAugmentationPrice(a));
		addToCart.forEach(augment => {
			cartNamesOnly.push(augment);
			cart.push({name: augment, faction: faction, price: ns.singularity.getAugmentationPrice(augment)});
		});
	}
	//Purchase starting from most expensive
	cart.sort((a, b) => b.price - a.price);
	for (const augment of cart) {
		if (ns.singularity.purchaseAugmentation(augment.faction, augment.name))
			boughtCounter++;
		else
			break;
	}
	return boughtCounter;
}

/** 
 * This function tries to satisfy the conditions to join a specific faction.
 * @param {NS} ns 
 * @param {string} faction
 * @return {boolean} true if it completed the required tasks, false if they cannot be completed.
 */
async function canGetInvited(ns, faction) { //TODO: Add logging
	//Skip if we already have the invitation
	if (ns.singularity.checkFactionInvitations().includes(faction)) return true;
	//Handle city factions
	if (CITY_FACTIONS.includes(faction)) {
		//They're all racist
		let goodToJoin = false;
		if (!hasJoinedAny(ns, CITY_FACTIONS))
			goodToJoin = true;
		else if (hasJoinedAny(ns, US_FACTIONS) && US_FACTIONS.includes(faction))
			goodToJoin = true;
		else if (hasJoinedAny(ns, ASIA_FACTIONS) && ASIA_FACTIONS.includes(faction))
			goodToJoin = true;
		//Let's take a plane
		if (goodToJoin && ns.singularity.travelToCity(faction)) {
			ns.print(`Travelled to ${faction}`);
			return (ns.getServerMoneyAvailable('home') >= 50e6); // Volhaven has the highest requirements at 50m
		}
		else
			return false;
	}
	//Handle early factions
	if (EARLY_FACTIONS.includes(faction)) {
		switch (faction) {
			case 'Tian Di Hui':
				if (ns.singularity.travelToCity('Ishima')) {
					ns.print(`Travelled to Ishima`);
					return (ns.getServerMoneyAvailable('home') >= 1e6 && ns.getHackingLevel() >= 50);
				}
				else return false;
			case 'Netburners':
				return (ns.run('hashnet.js') != 0);
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
				return await tryBackdooring(ns, 'CSEC');
			case 'NiteSec':
				return await tryBackdooring(ns, 'avmnite-02h');
			case 'The Black Hand':
				return await tryBackdooring(ns, 'I.I.I.I');
			case 'BitRunners':
				return await tryBackdooring(ns, 'run4theh111z');
			default:
				return false;
		}
	}
	//Handle corporate factions
	if (CORPO_FACTIONS.includes(faction)) {
		if (faction === 'Fulcrum Secret Technologies') {
			//ns.print('ERROR You need to manually backdoor the server fulcrumassets to join FST.');
			if (applyToCompany(ns, 'Fulcrum Technologies') && ns.singularity.workForCompany('Fulcrum Technologies', false))
				if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel('fulcrumassets'))
					return await tryBackdooring(ns, 'fulcrumassets');
			return false;	
		}
		else
			return (applyToCompany(ns, faction) && ns.singularity.workForCompany(faction, false));
	}
	//Handle corporate factions
	if (CORPO_FACTIONS.includes(faction)) {
		if (faction === 'Fulcrum Secret Technologies') {
			if (applyToCompany(ns, 'Fulcrum Technologies') && ns.singularity.workForCompany('Fulcrum Technologies', false))
				if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel('fulcrumassets'))
					return await tryBackdooring(ns, 'fulcrumassets');
			return false;	
		}
		else
			return (applyToCompany(ns, faction) && ns.singularity.workForCompany(faction, false));
	}
	//Handle crime factions
	if (CRIME_FACTIONS.includes(faction)) {
		switch (faction) {
			case 'Silhouette':
				return ns.corporation.hasCorporation();
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
	const playerFactions = ns.getPlayer().factions;
	if (playerFactions.includes(faction)) return true;
	while (!ns.singularity.checkFactionInvitations().includes(faction) && !playerFactions.includes(faction))
		await ns.sleep(60e3);
	return ns.singularity.joinFaction(faction) || playerFactions.includes(faction);
}

/**
 * @param {NS} ns
 * @param {string[]} factions
 * @return {boolean}
 */
function hasJoinedAny(ns, factions) {
	const joinedFactions = ns.getPlayer().factions;
	for (const faction of factions)
		if (joinedFactions.includes(faction))
			return true;
	return false;
}

/**
 * @param {NS} ns
 * @param {string} target
 * @return {boolean}
 */
async function tryBackdooring(ns, target) {
	if (ns.hasRootAccess(target) && ns.getServerRequiredHackingLevel(target) <= ns.getHackingLevel())
		return await backdoorTarget(ns, target);
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

/**
 * @param {NS} ns
 */
function joinPendingFactions(ns) {
	const invitations = ns.singularity.checkFactionInvitations();
	for (const faction of invitations)
		ns.singularity.joinFaction(faction);
}