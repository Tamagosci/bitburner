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
const CRIME_FACTIONS = ['Slum Snakes', 'Shadows of Anarchy', 'Tetrads',
	'Speakers for the Dead', 'The Dark Army', 'The Syndicate'];//, 'Silhouette'
const CORPO_FACTIONS = ['ECorp', 'MegaCorp', 'Bachman & Associates',
	'Blade Industries', 'NWO', 'Clarke Incorporated',
	'OmniTek Incorporated', 'KuaiGong International', 'Fulcrum Secret Technologies'];

const HACKING_STATS = ['hacking_chance', 'hacking_speed', 'hacking_money', 'hacking_grow', 'hacking', 'hacking_exp']
const COMBAT_STATS = ['strength', 'strength_exp', 'defense', 'defense_exp', 'dexterity', 'dexterity_exp', 'agility', 'agility_exp']
const COMPANY_STATS = ['charisma', 'charisma_exp', 'company_rep', 'work_money']
const CRIME_STATS = ['crime_success', 'crime_money']
const HACKNET_STATS = ['hacknet_node_money', 'hacknet_node_purchase_cost', 'hacknet_node_ram_cost', 'hacknet_node_core_cost', 'hacknet_node_level_cost']
const BLADEBURNER_STATS = ['bladeburner_max_stamina', 'bladeburner_stamina_gain', 'bladeburner_analysis', 'bladeburner_success_chance']

const ALL_FACTIONS = [
	'Tian Di Hui', 'Netburners',
	'CyberSec', 'NiteSec', 'The Black Hand', 'BitRunners',
	'Sector-12', 'Aevum', 'Volhaven', 'Chongqing', 'New Tokyo', 'Ishima',
	'Slum Snakes', 'Tetrads', 'Speakers for the Dead', 'The Dark Army', 'The Syndicate',
	'Illuminati', 'Daedalus', 'The Covenant',
	'Silhouette', 'Bladeburner', 'Church of the Machine God', , 'Shadows of Anarchy',
	'ECorp', 'MegaCorp', 'Bachman & Associates', 'Blade Industries', 'NWO', 'Clarke Incorporated', 'OmniTek Incorporated', 'KuaiGong International', 'Fulcrum Secret Technologies'
];

const FACTION_BLACKLIST = ['Shadows of Anarchy', 'Church of the Machine God', 'Bladeburner', 'Daedalus', 'Silhouette'];

const FACTION_JOBS = ['hacking', 'field', 'security'];
const COMPANY_JOBS = ['Agent', 'Business', 'IT', 'Software Consultant', 'Software', 'Security'];

const MIN_HACK_MULTIPLIER_FOR_DAEDALUS = 20;
const MIN_COMBAT_MULTIPLIER_FOR_DAEDALUS = 20;

const MAX_REP_COST = 465e3;
const CALLBACK = 'auto_start.js';
const NFG = 'NeuroFlux Governor';

/** @param {NS} ns */
export async function main(ns) {
	let [onlyAugments = false] = ns.args;
	if (onlyAugments)
		buyAugments(ns);
	else
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
	ns.moveTail(1957, 0);
	ns.resizeTail(341, 256);

	// Faction selection
	const targetFaction = chooseNextFactionByBitnode(ns)
	//const targetFaction = chooseNextFactionByReputationRequirements(ns)
	if (targetFaction === undefined) {
		ns.print(`Completed all factions, attempting to backdoor world daemon.`);
		const node = ns.getResetInfo().currentNode
		// This increases ram cost too much
		/*
		while (true) {
			if (node === 12) ns.singularity.destroyW0r1dD43m0n(12, CALLBACK)
			ns.run('servers/backdoor.js')
			//TODO: add bladeburner node conclusion
			await ns.sleep(60e3)
		}
		*/
	}
	ns.print(`INFO Targeting faction ${targetFaction}`);

	// Calculate target reputation/favor
	const nodeMultipliers = ns.getBitNodeMultipliers()
	const targetFavor = 150 * nodeMultipliers.RepToDonateToFaction
	const needFavor = shouldUnlockDonations(ns, targetFaction);
	ns.print(`Need favor is ${needFavor}`)
	const targetRep = (needFavor)
		? MAX_REP_COST * nodeMultipliers.RepToDonateToFaction
		: getFactionData(ns, targetFaction, ns.singularity.getOwnedAugmentations(true)).maxRepRequired;
	ns.print(`INFO Targeting reputation ${ns.formatNumber(targetRep, 0, 10e3)}`);

	// Check whether the faction was already joined
	let waitInvite;
	let joined = waitInvite = ns.getPlayer().factions.includes(targetFaction);
	if (joined) ns.print(`Player already joined ${targetFaction}`);

	do {
		//Try to satisfy faction invite conditions
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
			// Join any other available factions to get passive reputation/favor
			joinPendingFactions(ns);
			// Skip the reputation grind using corporation if possible
			ns.run('factions/bribe.js');
			await ns.sleep(1e3);

			// Update values
			const favorGainedFromInstall = ns.singularity.getFactionFavorGain(targetFaction);
			const factionFavor = ns.singularity.getFactionFavorGain(targetFaction);
			const factionRep = ns.singularity.getFactionRep(targetFaction);

			// Need to earn reputation
			if ((needFavor && factionFavor + favorGainedFromInstall < targetFavor) || (!needFavor && factionRep < targetRep)) {
				ns.print(`Current reputation ${ns.formatNumber(factionRep, 1, 1e3)} / ${ns.formatNumber(targetRep, 1, 1e3)}`);

				// If possible use donations
				if (factionFavor > targetFavor) {
					//Donate 10% of owned money until satisfied
					const moneyToDonate = ns.getServerMoneyAvailable('home') * 0.1;
					ns.singularity.donateToFaction(targetFaction, moneyToDonate);
					ns.print(`Donated ${ns.formatNumber(moneyToDonate, 1)} dollars to ${targetFaction} for reputation`);
				}

				// Otherwise work for it (if bladeburner allows)
				else if (!ns.bladeburner.inBladeburner() || ns.singularity.getOwnedAugmentations(false).includes("The Blade's Simulacrum"))
					workForRep(ns, targetFaction);
			}
			
			// We reached our reputation target and, if we do not need favor, have bought every augment from our chosen faction
			else if ((!needFavor && buyAugments(ns, targetFaction)) || needFavor) {
				// Buy augments so that we can install if we are here for favor
				if (needFavor) buyAugments(ns);

				// Do not install augments if it would interrupt a graft
				if (ns.singularity.getCurrentWork()?.type === 'GRAFTING')
					ns.print('WARN Delaying augment install due to grafting!');

				// If we need favor we have at least one augment, otherwise we have all augments from our chosen faction
				else if (ns.singularity.getOwnedAugmentations(true) > ns.singularity.getOwnedAugmentations(false)) {
					ns.print('WARN About to install augments!'*5);
					ns.killall('home', true);
					//Wait for script to finish selling stocks
					await ns.sleep(5e3);
					//Try buying extra augments with stock money
					buyAugments(ns);
					//Buy as many NFG as possible
					while (ns.singularity.purchaseAugmentation(targetFaction, NFG));
					//Reset
					ns.singularity.installAugmentations(CALLBACK);
				}

				// We do not have any augment to install
				else if (needFavor) ns.print('WARN Failed to restart for favor due to lack of augments');
			}

			// We reached our reputation target and do not need favor but have failed to purchase all augments from our chosen faction
			else ns.print(`Waiting for money... (${formatTime(Math.floor(ns.getRunningScript().onlineRunningTime)*1000)})`);
		}

		// Wait a minute before checking again
		await ns.sleep(60e3);
	} while (true);
}

/** 
 * @param {NS} ns 
 * @return {string} Faction name
 */
function chooseNextFactionByBitnode(ns) {
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
		let allStats = []
		allStats = allStats.concat(HACKING_STATS, COMBAT_STATS, HACKNET_STATS, CRIME_STATS, COMPANY_STATS, BLADEBURNER_STATS)
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
	if (shouldJoinDaedalus(ns, ownedAugments)) return 'Daedalus'

	//Load all factions as options
	const gangFaction = (ns.gang.inGang()) ? ns.gang.getGangInformation().faction : undefined
	const factionOptions = ALL_FACTIONS
		// Remove special factions
		.filter(faction => !FACTION_BLACKLIST.includes(faction) && faction !== gangFaction)
		// Turn names into useful data
		.map(faction => getFactionData(ns, faction, ownedAugments))
		// Remove factions that don't offer augments with the preferred stats
		.filter(faction => faction.newAugments.some(augment => Object.keys(augment.stats).some(stat => preferredStats.includes(stat))))
		// Sort by lowest rep requirement
		.sort((faction1, faction2) => faction1.maxRepRequired - faction2.maxRepRequired)

	return factionOptions[0]?.name
}

/**
 * @param {NS} ns
 * @return {string}
 */
function chooseNextFactionByReputationRequirements(ns) {
	const ownedAugments = ns.singularity.getOwnedAugmentations(true)

	//Daedalus special case
	if (shouldJoinDaedalus(ns, ownedAugments)) return 'Daedalus'

	//Load all factions
	const gangFaction = (ns.gang.inGang()) ? ns.gang.getGangInformation().faction : undefined
	const factionOptions = ALL_FACTIONS
		// Remove special ones
		.filter(faction => !FACTION_BLACKLIST.includes(faction) && faction !== gangFaction)
		// Turn names into useful data
		.map(faction => getFactionData(ns, faction, ownedAugments))
		// Remove factions that don't offer unowned augments
		.filter(faction => faction.newAugments.length > 0)
		//Sort by lowest rep requirement
		.sort((faction1, faction2) => faction1.maxRepRequired - faction2.maxRepRequired)

	return factionOptions[0]?.name
}

/**
 * @param {NS} ns
 * @param {string} faction
 * @param {string[]} ownedAugments
 * @return {{name: string, allAugments: {name: string, repRequirement: number, basePrice: number, stats: Multipliers}[], newAugments: {name: string, repRequirement: number, basePrice: number, stats: Multipliers}[], maxRepRequired: number}}
 */
function getFactionData(ns, faction, ownedAugments = []) {
	// Load and format data about augments
	const allAugments = ns.singularity.getAugmentationsFromFaction(faction)
		.map(augment => ({
			name: augment,
			repRequirement: ns.singularity.getAugmentationRepReq(augment),
			basePrice: ns.singularity.getAugmentationBasePrice(augment),
			stats: ns.singularity.getAugmentationStats(augment)
		}))
	
	// Separate augments not owned
	const newAugments = (ownedAugments.length > 0)
		? allAugments.filter(augment => !ownedAugments.includes(augment.name) && augment.name !== NFG)
		: undefined

	// Calculate highest reputation required by a new augment
	const maxRepRequired = newAugments.reduce((total, augment) => (augment.repRequirement > total) ? augment.repRequirement : total, 0)

	return {
		name: faction,
		allAugments: allAugments,
		newAugments: newAugments,
		maxRepRequired: maxRepRequired
	}
}

/**
 * @param {NS} ns
 * @param {string[]} ownedAugments
 * @return {boolean}
 */
function shouldJoinDaedalus(ns, ownedAugments) {
	const nodeMultipliers = ns.getBitNodeMultipliers();
	if (ownedAugments.includes('The Red Pill')) return false;
	if (ownedAugments.length < nodeMultipliers.DaedalusAugsRequirement) return false;

	const player = ns.getPlayer();
	const strMult = player.mults.strength_exp * player.mults.strength * nodeMultipliers.StrengthLevelMultiplier;
	const defMult = player.mults.defense_exp * player.mults.defense * nodeMultipliers.DefenseLevelMultiplier;
	const dexMult = player.mults.dexterity_exp * player.mults.dexterity * nodeMultipliers.DexterityLevelMultiplier;
	const agiMult = player.mults.agility_exp * player.mults.agility * nodeMultipliers.AgilityLevelMultiplier;
	const hackMult = player.mults.hacking_exp * nodeMultipliers.HackExpGain * player.mults.hacking * nodeMultipliers.HackingLevelMultiplier;
	const lowestCombatMult = Math.min(strMult, defMult, dexMult, agiMult);

	return (hackMult >= MIN_HACK_MULTIPLIER_FOR_DAEDALUS || lowestCombatMult >= MIN_COMBAT_MULTIPLIER_FOR_DAEDALUS);
}

/** 
 * @param {NS} ns 
 * @param {string} faction
 * @return {boolean}
 */
function shouldUnlockDonations(ns, faction) {
	const nodeMultiplier = ns.getBitNodeMultipliers().RepToDonateToFaction
	if (ns.singularity.getFactionFavor(faction) > 150 * nodeMultiplier) return false; //If we can already buy no need to unlock
	return (getHighestRepRequirement(ns, faction) > MAX_REP_COST * nodeMultiplier);
}

/** 
 * @param {NS} ns 
 * @param {string} faction
 * @return {number}
 */
function getHighestRepRequirement(ns, faction) {
	const augments = ns.singularity.getAugmentationsFromFaction(faction)
		.filter(augment => augment !== NFG)
		.map(augmentName => ({name: augmentName, repRequired: ns.singularity.getAugmentationRepReq(augmentName)}));
	if (augments.length === 0) {
		ns.printf('ERROR Something went wrong checking the rep requirements of %s.', faction);
		ns.tprintf('ERROR Something went wrong checking the rep requirements of %s.', faction);
		return 0;
	}
	augments.sort((a, b) => b.repRequired - a.repRequired);
	return augments[0].repRequired;
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
 * @param {string} priorityFaction
 * @return {boolean}
 */
function buyAugments(ns, priorityFaction = undefined) {
	/** @type {{name: string, faction: string, price: number, prerequisites: string[]}[]} */
	const joinedFactions = ns.getPlayer().factions;
	const augmentsICouldBuy = [];

	// Sort factions by descending reputation so that we record augments with the faction most likely to have enough rep
	joinedFactions.sort((a, b) => ns.singularity.getFactionRep(b) - ns.singularity.getFactionRep(a));

	// Put priority faction first so we don't record augments they sell as augments from another faction
	if (priorityFaction !== undefined)
		joinedFactions.sort((faction1, faction2) => {
			if (faction1 === priorityFaction) return -1;
			if (faction2 === priorityFaction) return 1;
			return 0;
		})
	
	// Store data about all the augments I have access to
	for (const faction of joinedFactions) {
		const factionAugments = ns.singularity.getAugmentationsFromFaction(faction)
			.map(augment => ({
				name: augment,
				faction: faction,
				price: ns.singularity.getAugmentationPrice(augment),
				prerequisites: ns.singularity.getAugmentationPrereq(augment)
			}))
			// Skip augments I already recorded from another faction
			.filter(augment => !augmentsICouldBuy.some(augmentICouldBuy => augmentICouldBuy.name === augment.name)); // !some or every! ???
		factionAugments.forEach(augment => augmentsICouldBuy.push(augment))
	}

	// Remove NFG and augments I already own
	// Note: NFGs are handled separately
	const ownedAugments = ns.singularity.getOwnedAugmentations(true);
	/** @type {{name: string, faction: string, price: number, prerequisites: string[]}[]} */
	const augmentsIWantToBuy = augmentsICouldBuy.filter(augment => !ownedAugments.includes(augment.name) && augment.name != NFG);

	// Claim we bought everything if the isn't anything to buy
	if (augmentsIWantToBuy.length === 0) return true;

	// Sort by descending price
	augmentsIWantToBuy.sort((a, b) => b.price - a.price);		
		
	// Put augments from the priority faction first
	if (priorityFaction !== undefined)
		augmentsIWantToBuy.sort((a, b) => {
			if (a.faction === b.faction) return 0;
			if (a.faction === priorityFaction) return -1;
			if (b.faction === priorityFaction) return 1;
			return 0;
		})
	
	// Put augments required by other augments before the one which requires them (even before priority)
	augmentsIWantToBuy.sort((a, b) => {
		if (a.prerequisites.includes(b.name)) return 1;
		if (b.prerequisites.includes(a.name)) return -1;
		return 0;
	});

	// Actual purchasing
	for (const augment of augmentsIWantToBuy) {
		if (ns.singularity.purchaseAugmentation(augment.faction, augment.name)) {
			ns.print(`Bought ${augment.name}\n  from ${augment.faction}`);
			ownedAugments.push(augment.name);
		}
		// Don't spend money on other factions before having bought everything from priority
		else if (priorityFaction !== undefined && augment.faction === priorityFaction) 
			break;
	}

	// If a priority faction was specified report whether we bought all augments from the priority faction
	if (priorityFaction !== undefined) {
		return augmentsIWantToBuy
			.filter(augment => !ownedAugments.includes(augment.name))
			.every(augment => augment.faction !== priorityFaction);
	}

	// If a priority faction was not specified report whether we bought everything
	else return augmentsIWantToBuy.filter(augment => !ownedAugments.includes(augment.name)).length === 0;
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