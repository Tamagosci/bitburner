import { formatMoney, compactTail } from 'disease.js';

const NAMES = ['Astolfo', 'Bob', 'Alt+F4', 'Extended Warranty', 'Fra Mauro', 'Ghandi',
	'Juan', 'Steve', 'Pipino il Breve', 'Mio Cugino', 'Clem Grakata', 'Indian Scammer'];

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

const MAX_MEMBERS = 12;
const MIN_COMBINED_STATS = 800;
const MAX_WANTED_PENALTY = 0.95;
const TERRITORY_THRESHOLD = 0.75;
const CLASH_THRESHOLD = 0.55;
const AVAILABLE_BUDGET = 0.24;
const PREFERRED_FACTION = 'Speakers for the Dead';
const SNAKES = 'Slum Snakes';
const LONG_SLEEP = 19e3;
const BONUS_TIME_SLEEP = 500;

let maxedEquipment = {};
let members, equipment;

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
	await ns.sleep(200);

	if (ns.gang.inGang() === false) {
		ns.print('WARN Not in a gang, trying to create one...');
		if (ns.gang.createGang(PREFERRED_FACTION) || ns.gang.createGang(SNAKES))
			ns.print('SUCCESS Successfully created a gang!');
		else {
			ns.print('ERROR Failed to create a gang!');
			return;
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
		//Wait until tick is done
		await detectTerritoryTick(ns);
	}
}

/** @param {NS} ns */
function ascend(ns) {
	const gangInfo = ns.gang.getGangInformation();
	for (const member of members) {
		const result = ns.gang.getAscensionResult(member);
		if (result === undefined) continue;
		const threshold = getAscensionTreshold(ns, member, 'str');
		if (result.str < threshold && result.def < threshold && result.dex < threshold && result.agi < threshold) continue;
		//if (COMBAT_STATS.every(stat => result[stat] < getAscensionTreshold(ns, member, stat))) continue;
		/*
		const info = ns.gang.getMemberInformation(member);
		const percentOfRespect = Math.min(info.earnedRespect / gangInfo.respect, 0.999);
		if (percentOfRespect > 1 / members.length) {
			ns.print('WARN Holding ascension of ' + member);
			continue;
		}
		*/
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
	for (const member of members) {
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
			ns.print(`INFO Spent \$${formatMoney(spent, 0)} on ${member}'s equipment`);
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
		//const stats = ns.gang.getMemberInformation(member);
		//if (Math.min(stats.str, stats.def, stats.dex, stats.agi) < MIN_STATS) continue;
		ns.gang.setMemberTask(member, TASKS.territory);
		ns.print(`INFO Set ${member}'s task to ${TASKS.territory}`);
	}
	//Enable/Disable Territory Warfare
	const victoryChances = getClashVictoryChances(ns);
	const shouldEngage = Math.min(...victoryChances) >= CLASH_THRESHOLD && gangInfo.territory < 1;
	ns.gang.setTerritoryWarfare(shouldEngage);
	if (shouldEngage)
		ns.print('WARN Engaging in territory warfare!');
	else
		ns.print('WARN Chance to win clashes is too low to engage in warfare');
}

/** @param {NS} ns */
function getClashVictoryChances(ns) {
	const myGang = ns.gang.getGangInformation().faction;
	const enemyGangs = Object.keys(ns.gang.getOtherGangInformation()).filter(gang => gang != myGang);
	return enemyGangs.map(enemy => ns.gang.getChanceToWinClash(enemy));
}

/** @param {NS} ns */
async function detectTerritoryTick(ns) {
	//Ignore if territory is maxed
	const gangInfo = ns.gang.getGangInformation();
	if (gangInfo.territory === 1 && gangInfo.territoryClashChance === 0) return;
	let oldPower = ns.gang.getGangInformation().power;
	while (ns.gang.getGangInformation().power === oldPower)
		await ns.sleep(100);
	//Update in case someone dies
	members = ns.gang.getMemberNames();
}

// Credit: Mysteyes. https://discord.com/channels/415207508303544321/415207923506216971/940379724214075442
/**
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
		const reputationGainPercentageValue = Math.min(memberInfo.earnedRespect / gangInfo.respect, 0.999);
		const reputationGainPercentage = ns.formatPercent(reputationGainPercentageValue, 1).padStart(5, ' ');
		if (member.length > 10) {
			const pieces = member.split(' ');
			if (pieces[0].length <= 7)
				member = pieces[0] + ' ' + pieces[pieces.length - 1].substring(0, 1) + '.';
			else
				member = pieces[0];
		}
		member = member.padEnd(10, ' ');
		ns.print(`║ ${member} │ ${task} │ ${reputationGainPercentage} ║`);
	}
	//Footer
	const gangPower = formatMoney(gangInfo.power, 2 - Math.floor(Math.log10(gangInfo.power)) % 3).padStart(5, ' ');
	const victoryChance = ns.formatPercent(Math.min(0.999, ...getClashVictoryChances(ns)), 2).padStart(7, ' ');
	const clashEnabled = (gangInfo.territoryWarfareEngaged)
		? ' ON' : 'OFF';
	const territoryHeld = ns.formatPercent(gangInfo.territory, 2).padStart(7, ' ');
	ns.print('╟───────┬────┴──┬─────────┬─┴───────╢');
	ns.print(`║ Power │ ${gangPower} │ Victory │ ${victoryChance} ║`);
	ns.print('╟───────┼─────┬─┴─────────┼─────────╢');
	ns.print(`║ Clash │ ${clashEnabled} │ Territory │ ${territoryHeld} ║`);
	ns.print('╚═══════╧═════╧═══════════╧═════════╝');
	//Resize
	compactTail(ns.getScriptName());
	ns.resizeTail(360, 16 * (members.length + 10)); //16 per line + 32 of header
}