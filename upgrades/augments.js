import { formatTime } from 'utils.js';
import { backdoorTarget } from 'servers/backdoor.js';
import { spread } from 'servers/infect_all.js';

const CITY_FACTIONS = ['Sector-12', 'Aevum', 'Volhaven',
	'Chongqing', 'New Tokyo', 'Ishima'];
const US_FACTIONS = ['Sector-12', 'Aevum'];
const ASIA_FACTIONS = ['Chongqing', 'New Tokyo', 'Ishima'];
const EARLY_FACTIONS = ['Tian Di Hui', 'Netburners']
const LATE_FACTIONS = ['Daedalus', 'The Covenant', 'Illuminati'];
const HACK_FACTIONS = ['CyberSec', 'NiteSec', 'The Black Hand', 'BitRunners'];
const CRIME_FACTIONS = ['Slum Snakes', 'Shadows of Anarchy', 'Tetrads', 'Silhouette',
	'Speakers for the Dead', 'The Dark Army', 'The Syndicate'];
const CORPO_FACTIONS = ['ECorp', 'MegaCorp', 'Bachman & Associates',
	'Blade Industries', 'NWO', 'Clarke Incorporated',
	'OmniTek Incorporated', 'KuaiGong International', 'Fulcrum Secret Technologies'];

const HACK_PATH = ['CyberSec', 'Tian Di Hui', 'NiteSec', 'Chongqing',
	'Sector-12', 'The Black Hand', 'BitRunners']
const CRIME_PATH = ['Slum Snakes', 'Aevum', 'Sector-12', 'Ishima', 'New Tokyo', 
	'Volhaven', 'Tetrads', 'Speakers for the Dead', 'The Dark Army', 'The Syndicate']
const CORPO_PATH = ['Sector-12', 'Aevum', 'Tian Di Hui', 'Fulcrum Secret Technologies', 
	'Bachman & Associates', 'Silhouette', 'NWO']

const HACKING_STATS = ['hacking_chance', 'hacking_speed', 'hacking_money', 'hacking_grow', 'hacking', 'hacking_exp']
const COMBAT_STATS = ['strength', 'strength_exp', 'defense', 'defense_exp', 'dexterity', 'dexterity_exp', 'agility', 'agility_exp']
const COMPANY_STATS = ['charisma', 'charisma_exp', 'company_rep', 'work_money']
const CRIME_STATS = ['crime_success', 'crime_money']
const HACKNET_STATS = ['hacknet_node_money', 'hacknet_node_purchase_cost', 'hacknet_node_ram_cost', 'hacknet_node_core_cost', 'hacknet_node_level_cost']
const BLADEBURNER_STATS = ['bladeburner_max_stamina', 'bladeburner_stamina_gain', 'bladeburner_analysis', 'bladeburner_success_chance']

const FACTION_BLACKLIST = ['Shadows of Anarchy', 'Church of the Machine God'];

const FACTION_JOBS = ['hacking', 'field', 'security'];
const COMPANY_JOBS = ['Agent', 'Business', 'IT', 'Software Consultant', 'Software', 'Security'];

const MAX_REP_COST = 465e3;
const CALLBACK = 'auto_start.js';
const NFG = 'NeuroFlux Governor';

/** @param {NS} ns */
export async function main(ns) {
	await obtainAugments(ns);
}

/** 
 * @param {NS} ns 
 * @param {'hack'|'crime'|'corpo'} objective
 * @param {boolean} loop
 */
export async function obtainAugments(ns) {
	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(0);
	ns.moveTail(1957, 28);
	ns.resizeTail(341, 228);

	//Setup (OLD)
	//Keeping as backup
	/*
	let targetFaction = findFactionByObjective(ns, objective);
	if (targetFaction === 'none') {
		ns.print(`INFO Completed all factions related to ${objective}, attempting other objectives`);
		for (const secondaryObjective of OBJECTIVES) {
			targetFaction = findFactionByObjective(ns, secondaryObjective);
			if (targetFaction !== 'none') break;
		}
		if (targetFaction === 'none') {
			ns.print(`Completed all factions, attempting to backdoor world daemon.`);
			while (true) {
				ns.run('servers/backdoor.js')
				await ns.sleep(60e3)
			}
		}
	}
	*/
	//Setup
	const targetFaction = chooseNextFaction(ns)
	if (targetFaction === undefined) {
		ns.print(`Completed all factions, attempting to backdoor world daemon.`);
		const node = ns.getResetInfo().currentNode
		while (true) {
			if (node === 12) ns.singularity.destroyW0r1dD43m0n(12, CALLBACK)
			else ns.run('servers/backdoor.js')
			await ns.sleep(60e3)
		}
	}
	const nodeMultipliers = ns.getBitNodeMultipliers()
	ns.print(`INFO Targeting faction ${targetFaction}`);
	const needFavor = shouldUnlockDonations(ns, targetFaction);
	const targetRep = (needFavor)
		? MAX_REP_COST * nodeMultipliers.RepToDonateToFaction
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
				if (ns.singularity.getFactionFavor(targetFaction) > 150 * nodeMultipliers.RepToDonateToFaction) {
					//Donate 10% of owned money until satisfied
					const moneyToDonate = ns.getServerMoneyAvailable('home') * 0.1
					ns.singularity.donateToFaction(targetFaction, moneyToDonate);
					ns.print(`Donated ${ns.formatNumber(moneyToDonate, 1)} dollars to ${targetFaction} for favor`);
				}
				//Otherwise work for it
				else if (!ns.bladeburner.inBladeburner() || ns.singularity.getOwnedAugmentations(false).includes("The Blade's Simulacrum"))
					workForRep(ns, targetFaction);
			}
			//Buy augments
			else if ((!needFavor && buyAllAugmentsPriority(ns, targetFaction)) || needFavor) {
				if (needFavor) buyAllAugmentsPriority(ns, targetFaction);
				if (ns.singularity.getCurrentWork()?.type === 'GRAFTING')
					ns.print('WARN Delaying augment install due to grafting!')
				//else if(ns.corporation.hasCorporation() && (ns.corporation.getCorporation().divisions.length < 3 || ns.corporation.getDivision('Sikar').products.length === 0))
				//	ns.print('WARN Delaying augment install due corporation script!')
				else if (ns.singularity.getOwnedAugmentations(true) > ns.singularity.getOwnedAugmentations(false)) {
					ns.print('WARN About to install augments!'*5);
					ns.killall('home', true);
					//Wait for script to finish selling stocks
					await ns.sleep(5e3);
					//Try buying extra augments with stock money
					buyAllAugmentsPriority(ns, targetFaction);
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
	} while (true);
}

/** 
 * @param {NS} ns 
 * @param {'hack'|'crime'|'corp'|'combat'} objective
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
			if (faction !== 'Daedalus' || ns.singularity.getOwnedAugmentations(false) >= 30)
				return faction;
	//Found nothing
	return 'none';
}

/** 
 * @param {NS} ns 
 * @return {string} Faction name
 */
function chooseNextFaction(ns) {
	let statsPriority = ['faction_rep']
	const resetInfo = ns.getResetInfo()
	const currentBitNode = resetInfo.currentNode
	const sf12 = resetInfo.ownedSF.get(12)
	switch (currentBitNode) {
		//Hacking
		case 1:
		case 2:
		case 3:
		case 4:
		case 5:
		case 10:
		case 14:
			statsPriority = statsPriority.concat(HACKING_STATS)
			break
		//Hacknet
		case 9:
			statsPriority = statsPriority.concat(HACKNET_STATS)
		//Bladeburner
		case 6:
		case 7:
		case 13:
			statsPriority = statsPriority.concat(BLADEBURNER_STATS, COMBAT_STATS)
			break
		//Crime and hacking
		case 8:
			statsPriority = statsPriority.concat(CRIME_STATS, HACKING_STATS)
			break
		//Company
		case 11:
			statsPriority = statsPriority.concat(COMPANY_STATS, HACKING_STATS, HACKNET_STATS)
			break
		//12 is special
		case 12:
			if (sf12 < 800)
				//Hacking prio
				statsPriority = statsPriority.concat(HACKNET_STATS, HACKING_STATS)
			else if (sf12 < 12000)
				//Hacknet => Bladeburner
				statsPriority = statsPriority.concat(HACKNET_STATS, BLADEBURNER_STATS)
			else
				throw new Error('Don\'t know which augments to take here')
			break
		default:
			throw new Error('Current BitNode is not present in augment logic')
	}

	let faction = chooseFactionByPreferredStats(ns, statsPriority)
	if (faction === undefined) {
		const allStats = []
		allStats.concat(HACKING_STATS, COMBAT_STATS, HACKNET_STATS, CRIME_STATS, COMPANY_STATS, BLADEBURNER_STATS)
		faction = chooseFactionByPreferredStats(ns, allStats)
	}

	return faction
}

/**
 * @param {NS} ns
 * @param {string[]} preferredStats
 * @return {string} Faction name
 */
function chooseFactionByPreferredStats(ns, preferredStats) {
	if (preferredStats.length === 0) return undefined
	const ownedAugments = ns.singularity.getOwnedAugmentations(true)
	//Daedalus special case
	if (!ownedAugments.includes('The Red Pill') && ownedAugments.length >= ns.getBitNodeMultipliers().DaedalusAugsRequirement) return 'Daedalus'
	//Load all factions as options (does not incude anarchy or church, intended)
	let factionOptions = []
	factionOptions = factionOptions.concat(EARLY_FACTIONS, LATE_FACTIONS, CITY_FACTIONS, HACK_FACTIONS, CRIME_FACTIONS, CORPO_FACTIONS)
	factionOptions = factionOptions.filter(faction => faction !== 'Daedalus')
	//Remove gang faction
	if (ns.gang.inGang()) {
		const gangFaction = ns.gang.getGangInformation().faction
		factionOptions = factionOptions.filter(faction => faction !== gangFaction)
	}
	//Save useful data
	let factionsData = factionOptions.map(faction => {
		//Remove factions that only offer augments I already own
		//If I own everything list will be empty => statsCovered will be empty => filtering for preferred stats will fail (intended)
		const augmentList = ns.singularity.getAugmentationsFromFaction(faction).filter(augment => !ownedAugments.includes(augment) && augment !== NFG)
		const maxRep = augmentList.reduce((max, augment) => {
			const augmentRepRequirement = ns.singularity.getAugmentationRepReq(augment)
			return (augmentRepRequirement > max) ? augmentRepRequirement : max
		}, 0)
		//Check which stats are covered by at least one augment (I don't already have) offered by the faction
		let statsCovered = []
		augmentList.forEach(augment => {
			const augmentStats = ns.singularity.getAugmentationStats(augment)
			for (const stat of preferredStats)
				if (augmentStats[stat] !== 1 && !statsCovered.includes(stat))
					statsCovered.push(stat)
		})
		return {name: faction, repRequired: maxRep, stats: statsCovered}
	})
	//Remove factions that don't offer augments with the preferred stats
	factionOptions = factionsData.filter(faction => faction.stats.some(stat => preferredStats.includes(stat)))
	//Sort by lowest rep requirement
	factionOptions.sort((faction1, faction2) => faction1.repRequired - faction2.repRequired)

	return factionOptions[0]?.name
}

/** 
 * @param {NS} ns 
 * @param {string} faction
 * @return {boolean}
 */
function shouldUnlockDonations(ns, faction) {
	const nodeMultipliers = ns.getBitNodeMultipliers()
	if (ns.singularity.getFactionFavor(faction) > 150 * nodeMultipliers.RepToDonateToFaction) return false; //If we can already buy no need to unlock
	return (highestRepCost(ns, faction) > MAX_REP_COST * nodeMultipliers.RepToDonateToFaction);
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
		ns.tprintf('ERROR Something went wrong checking the rep requirements of %s.', faction);
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
	let moneyLeft = ns.getPlayer().money;
	let boughtAll = true;
	let missingAugments = needToBuy.length;
	for (const augment of needToBuy) {
		const augmentCost = ns.singularity.getAugmentationPrice(augment);
		if (ns.singularity.purchaseAugmentation(faction, augment)) {
			ns.print(`Bought ${augment}\n  from ${faction}`);
			missingAugments--;
			moneyLeft -= augmentCost;
		}
		else if (moneyLeft > augmentCost) {
			boughtAll = false;
			continue;
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
	const result = (priorityFaction !== undefined)
		? buyAugments(ns, priorityFaction)
		: true;  //Buy augments for target faction
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