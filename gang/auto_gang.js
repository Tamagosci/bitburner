import { compactTail } from 'utils.js';

const NAMES = ['Astolfo', 'Bob', 'Alt+F4', 'Extended Warranty', 'Fra Mauro', 'Ghandi',
			'Juan', 'Steve', 'Batman', 'John Wick', 'Clem', 'Indian Scammer',
			'Jesus', 'John Cena', 'Chuck Norris', 'Ray Fridgerator'];

const TASKS = {
	unassigned: 'Unassigned',
	mug: 'Mug People',
	drugs: 'Deal Drugs',
	civlians: 'Strongarm Civilians',
	con: 'Run a Con',
	robbery: 'Armed Robbery',
	trafficArms: 'Traffick Illegal Arms',
	blackmail: 'Threaten & Blackmail',
	trafficHumans: 'Human Trafficking',
	terrorism: 'Terrorism',
	vigilante: 'Vigilante Justice',
	trainCombat: 'Train Combat',
	trainHack: 'Train Hacking',
	trainCharisma: 'Train Charisma',
	territory: 'Territory Warfare'
}

const COMBAT_STATS = ['str', 'def', 'dex', 'agi'];

const MAX_MEMBERS = 12;
const MIN_COMBINED_STATS = 1200;
const MIN_DEF_TO_WARFARE = 400;
const MAX_WANTED_PENALTY = 0.99;
const TERRITORY_THRESHOLD = 0.75;
const CLASH_THRESHOLD = 0.6;
const AVAILABLE_BUDGET = 0.12;
const PREFERRED_FACTION = 'Speakers for the Dead';
const SNAKES = 'Slum Snakes';
const LONG_SLEEP = 19e3;
const BONUS_TIME_SLEEP = 500;

/** @type {{string: boolean}} */
let maxedEquipment = {};
/** @type {string[]} */
let members;
/** @type {string[]} */
let equipment;

/** @param {NS} ns */
export async function main(ns) {
	await army(ns);
}

/** @param {NS} ns */
async function army(ns) {
	//Logging 
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(0);
	ns.resizeTail(360, 16 * 15); //or 16*22 full size
	//ns.moveTail(1597, 256);
	//ns.moveTail(1597, 28);
	ns.moveTail(1081, 28);

	if (ns.gang.inGang() === false) {
		ns.print('WARN Not in a gang, trying to create one...');
		if (ns.gang.createGang(PREFERRED_FACTION) || ns.gang.createGang(SNAKES))
			ns.print('SUCCESS Successfully created a gang!')
		else {
			const karma = ns.getPlayer().karma
			ns.print('ERROR Failed to create a gang!')
			ns.print(`Karma : ${karma.toFixed(0)} / -54000  (${ns.formatPercent(karma/-54000, 1)})`)
			return
		}
	}

	//Load constants
	equipment = ns.gang.getEquipmentNames();
	equipment.sort((a, b) => ns.gang.getEquipmentCost(a) - ns.gang.getEquipmentCost(b));
	members = ns.gang.getMemberNames();

	//Shuffle names order
	NAMES.sort((a, b) => Math.random() - 0.5);

	while (true) {
		//Ascend
		ascend(ns);
		//Recruit new members
		recruit(ns);
		//Reassign jobs
		reassign(ns);
		//Buy equipment
		equip(ns);
		//Report
		report(ns);
		//Sleep
		await ns.sleep((ns.gang.getBonusTime() > LONG_SLEEP) ? BONUS_TIME_SLEEP : LONG_SLEEP);
		//Territory stuff
		territory(ns);
		//Report
		report(ns);
		//Wait until territory data changed
		await detectTerritoryTick(ns);
	}
}

/** @param {NS} ns */
function ascend(ns) {
	//const gangInfo = ns.gang.getGangInformation();
	for (const member of members) {
		const result = ns.gang.getAscensionResult(member);

		if (result === undefined) continue;
		if (COMBAT_STATS.every(stat => result[stat] < getAscensionTreshold(ns, member, stat))) continue;

		ns.gang.ascendMember(member);
		maxedEquipment[member] = false;
		ns.print('INFO Ascended ' + member);
	}
}

/** @param {NS} ns */
function recruit(ns) {
	while (ns.gang.canRecruitMember()) {
		const name = NAMES.find(name => members.includes(name) === false);
		ns.gang.recruitMember(name);
		members.push(name);
		ns.print('Recruited ' + name);
	}
}

/** @param {NS} ns */
function reassign(ns) {
	const gangInfo = ns.gang.getGangInformation();
	for (let i = 0; i < members.length; i++) {
		const member = members[i];
		const stats = ns.gang.getMemberInformation(member);
		//Train stats if under min
		if (stats.str + stats.def + stats.dex + stats.agi < MIN_COMBINED_STATS)
			ns.gang.setMemberTask(member, TASKS.trainCombat);
		//Get some vigilantes
		else if (gangInfo.wantedPenalty < MAX_WANTED_PENALTY && gangInfo.wantedLevel > 1)
			ns.gang.setMemberTask(member, TASKS.vigilante);
		//If missing members gain rep
		else if (members.length < MAX_MEMBERS)
			ns.gang.setMemberTask(member, TASKS.terrorism);
		//Others to trafficking arms if enough territory
		else if (ns.gang.getGangInformation().territory >= TERRITORY_THRESHOLD)
			ns.gang.setMemberTask(member, TASKS.trafficArms);
		//Or trafficking humans otherwise
		else
			ns.gang.setMemberTask(member, TASKS.trafficHumans);
		ns.print(`INFO Set ${member}'s task to ${ns.gang.getMemberInformation(member).task}`);
	}
}

/** @param {NS} ns */
function equip(ns) {
	let budget = ns.getPlayer().money * AVAILABLE_BUDGET;
	const maxPerMember = Math.floor(budget / members.length);
	for (const member of members) {
		if (maxedEquipment[member] === true) continue;
		let spent = 0;
		for (const item of equipment) {
			const cost = ns.gang.getEquipmentCost(item);
			if (cost < budget && spent + cost <= maxPerMember) {
				if (ns.gang.purchaseEquipment(member, item)) {
					budget -= cost;
					spent += cost;
					if (spent > maxPerMember) break;
				}
			}
			else break;
		}
		if (spent > 0)
			ns.print(`INFO Spent \$${ns.formatNumber(spent, 0)} on ${member}'s equipment`);
		const info = ns.gang.getMemberInformation(member);
		maxedEquipment[member] = equipment.every(item => info.upgrades.includes(item));
	}
}

/** @param {NS} ns */
function territory(ns) {
	//Ignore if territory is maxed
	const gangInfo = ns.gang.getGangInformation();
	if (gangInfo.territory === 1 && gangInfo.territoryClashChance === 0) return;
	//Set members to warfare
	for (const member of members) {
		const stats = ns.gang.getMemberInformation(member);
		if (stats.def < MIN_DEF_TO_WARFARE && gangInfo.territoryClashChance > 0) continue;
		ns.gang.setMemberTask(member, TASKS.territory);
		ns.print(`INFO Set ${member}'s task to ${TASKS.territory}`);
	}
	//Enable/Disable Territory Warfare
	const shouldEngage = getAverageClashVictoryChance(ns, true) >= CLASH_THRESHOLD;
	ns.gang.setTerritoryWarfare(shouldEngage);
	if (shouldEngage)
		ns.print('WARN Engaging in territory warfare!');
	else
		ns.print('WARN Chance to win clashes is too low to engage in warfare');
}

/** @param {NS} ns */
function getClashVictoryChances(ns, considerOnlyGangsWithTerritory = false) {
	const myGang = ns.gang.getGangInformation().faction;
	const gangsInfo = ns.gang.getOtherGangInformation();
	const enemyGangs = Object.keys(gangsInfo).filter(gang => gang != myGang);
	if (considerOnlyGangsWithTerritory) {
		const enemyGangsWithTerritory = enemyGangs.filter(gang => gangsInfo[gang].territory > 0);
		return enemyGangsWithTerritory.map(enemy => ns.gang.getChanceToWinClash(enemy));
	}
	else return enemyGangs.map(enemy => ns.gang.getChanceToWinClash(enemy));
}

/** 
 * @param {NS} ns 
 * @param {boolean} considerOnlyGangsWithTerritory
 * @return The average clash victory chance.    
 * If considerOnlyGangsWithTerritory is true and no gang has territory returns 0.
 */
function getAverageClashVictoryChance(ns, considerOnlyGangsWithTerritory = false) {
	const victoryChances = getClashVictoryChances(ns, considerOnlyGangsWithTerritory);
	//If no one else has territory we can only lose if we fight
	return victoryChances.reduce((total, chance) => total + chance, 0) / Math.max(victoryChances.length, 1);
}

/** @param {NS} ns */
async function detectTerritoryTick(ns) {
	//Ignore if territory is maxed
	const gangInfo = ns.gang.getGangInformation();
	if (gangInfo.territory === 1 && gangInfo.territoryClashChance === 0) return;
	while (ns.gang.getGangInformation().power === gangInfo.power)
		await ns.sleep(100);
	//Update in case someone dies
	members = ns.gang.getMemberNames();
}

// Credit: Mysteyes. https://discord.com/channels/415207508303544321/415207923506216971/940379724214075442
/**
 * @param {NS} ns
 * @param {string} member
 * @param {'str' | 'def' | 'dex' | 'agi'} stat
 * @return {number}
 */
function getAscensionTreshold(ns, member, stat) {
	let mult = ns.gang.getMemberInformation(member)[stat + "_asc_mult"]
	if (mult < 1.632) return 1.6326
	if (mult < 2.336) return 1.4315
	if (mult < 2.999) return 1.284
	if (mult < 3.363) return 1.2125
	if (mult < 4.253) return 1.1698
	if (mult < 4.860) return 1.1428
	if (mult < 5.455) return 1.1225
	if (mult < 5.977) return 1.0957
	if (mult < 6.496) return 1.0869
	if (mult < 7.008) return 1.0789
	if (mult < 7.519) return 1.073
	if (mult < 8.025) return 1.0673
	if (mult < 8.513) return 1.0631
	return 1.05 // was 1.0591
}

/** @param {NS} ns */
function report(ns) {
	//╔═╗╚╝║╟╢╤╧╪─│┬┴┼▲▼
	//Header
	ns.print('╔════════════╤══════════════╤═══════╗');
	ns.print('║   Member   │ Current Task │ Resp% ║');
	ns.print('╟────────────┼──────────────┼───────╢');
	//Dynamic
	members = ns.gang.getMemberNames();
	const gangInfo = ns.gang.getGangInformation();
	for (let member of members) {
		const memberInfo = ns.gang.getMemberInformation(member);
		let task = memberInfo.task.padStart(12, ' ');
		if (task.length > 12) task = task.slice(0, 11) + '.';
		const respectGainPercentageValue = Math.min(memberInfo.earnedRespect / gangInfo.respect, 0.999);
		const respectGainPercentage = ns.formatPercent(respectGainPercentageValue, 1).padStart(5, ' ');
		if (member.length > 10) {
			const pieces = member.split(' ');
			if (pieces[0].length <= 7)
				member = pieces[0] + ' ' + pieces[pieces.length - 1].substring(0, 1) + '.';
			else
				member = pieces[0];
		}
		member = member.padEnd(10, ' ');
		ns.print(`║ ${member} │ ${task} │ ${respectGainPercentage} ║`);
	}
	//Footer
	const gangPower = ns.formatNumber(gangInfo.power, 2 - Math.floor(Math.log10(gangInfo.power)) % 3 + (gangInfo.power < 1e3) ? 1 : 0).padStart(5, ' ');
	const victoryChance = ns.formatPercent(getAverageClashVictoryChance(ns, gangInfo.territory < 1), 2).padStart(7, ' ');
	const clashEnabled = (gangInfo.territoryWarfareEngaged)
		? ' ON' : 'OFF';
	const territoryHeld = ns.formatPercent(gangInfo.territory, 2).padStart(7, ' ');
	ns.print('╟───────┬────┴──┬─────────┬─┴───────╢');
	ns.print(`║ Power │ ${gangPower} │ Victory │ ${victoryChance} ║`);
	ns.print('╟───────┼─────┬─┴─────────┼─────────╢');
	ns.print(`║ Clash │ ${clashEnabled} │ Territory │ ${territoryHeld} ║`);
	ns.print('╚═══════╧═════╧═══════════╧═════════╝');
	//Resize
	ns.resizeTail(360, 16 * (members.length + 10)); //16 per line + 32 of header
	compactTail(ns.getScriptName());
}