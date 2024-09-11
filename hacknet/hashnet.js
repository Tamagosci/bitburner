import { compactTail } from 'utils.js';

const HASH_STORE = {
	money: 'Sell for Money',
	corporation: 'Sell for Corporation Funds',
	minSecurity: 'Reduce Minimum Security',
	maxMoney: 'Increase Maximum Money',
	university: 'Improve Studying',
	gym: 'Improve Gym Training',
	research: 'Exchange for Corporation Research',
	rank: 'Exchange for Bladeburner Rank',
	skill: 'Exchange for Bladeburner SP',
	contract: 'Generate Coding Contract'
}

/** @param {NS} ns */
export async function main(ns) {
	let [target] = ns.args;
	if (target !== undefined && ns.serverExists(target)) spendHashesToMaxServer(ns, target);
	else await hashnet(ns);
}

const DEBUG_MODE = false;

const MAX_NODES = 20; //20 lowered to 14 for graphical reasons
const MAX_LEVEL = 300;
const MAX_RAM = 8192;
const MAX_CORES = 128;
const MAX_CACHE = 15;

const ALLOWED_FUNDS = 0.02;
const SLEEP = 5e3;

let BITNODE_MULT = 1;

let thisScript = 'hashnet.js';

/** @param {NS} ns */
async function hashnet(ns) {
	//Logging
	ns.disableLog('ALL');
	ns.tail();
	await ns.sleep(0);
	//ns.moveTail(1081, 28);
	ns.moveTail(1441, 28);

	//Variables setup
	BITNODE_MULT = ns.getBitNodeMultipliers().HacknetNodeMoney;
	thisScript = ns.getScriptName();
	let funds = 0;
	let nodesOwned = 0;
	let nextNodeCost = ns.hacknet.getPurchaseNodeCost();

	report(ns);

	//Main loop
	while (areAllNodesMaxed(ns) === false) {
		//Update founds
		funds = ns.getPlayer().money * ALLOWED_FUNDS;

		//Attempt to buy more nodes
		nodesOwned = ns.hacknet.numNodes();
		while (nodesOwned < MAX_NODES && nextNodeCost <= funds) {
			if (ns.hacknet.purchaseNode() === -1) break;
			funds -= nextNodeCost;
			nextNodeCost = ns.hacknet.getPurchaseNodeCost();
			ns.print('INFO Bought hashnet node ' + nodesOwned);
			report(ns);
			nodesOwned++;
		}

		//Calculate upgrades
		let allNodeUpgrades = new Array();
		for (let i = 0; i < nodesOwned; i++)
			allNodeUpgrades = allNodeUpgrades.concat(getUpgradeDetails(ns, i));
		//Priority for highest relative gain for hash upgrades and cost for cache
		allNodeUpgrades.sort((a, b) => a.cost - b.cost).sort((a, b) => b.relativeGain - a.relativeGain);

		//Upgrade hash production in order of priority
		for (const upgrade of allNodeUpgrades) {
			//ns.print(`DEBUG Looking at node ${upgrade.index} type ${upgrade.type} cost ${upgrade.cost} funds ${funds}`)
			if (upgrade.cost <= funds) {
				eval('ns.hacknet.upgrade' + upgrade.type + '(' + upgrade.index + ', 1);');
				funds -= upgrade.cost;
				ns.print(`INFO Upgraded node ${upgrade.index} ${upgrade.stat} to ${ns.hacknet.getNodeStats(upgrade.index)[upgrade.stat]}`);
				//report(ns);
			}
		}

		//Purchase contracts
		ns.hacknet.spendHashes(HASH_STORE.contract, undefined, 1)

		//Improve batcher target
		//TODO: read port, save target, lower minSec, increase monMax

		//Convert extra hashes into money
		if (ns.hacknet.numHashes() == ns.hacknet.hashCapacity() && nodesOwned > 0) {
			const hashCostOfMoney = ns.hacknet.hashCost(HASH_STORE.money);
			let amountOfMoneyToBuy = Math.floor(ns.hacknet.numHashes() * 0.1 / hashCostOfMoney);

			//TODO: Add purchase logging

			if (amountOfMoneyToBuy > 0) {
				ns.hacknet.spendHashes(HASH_STORE.money, undefined, amountOfMoneyToBuy);
				if (DEBUG_MODE) ns.print(`Spent ${amountOfMoneyToBuy * hashCostOfMoney} hashes for \$${ns.formatNumber(amountOfMoneyToBuy * MONEY_PER_HASH_PURCHASE, 0)}`);
			}
		}

		report(ns);
		await ns.sleep(SLEEP);
	}
}

/**
 * @param {NS} ns
 * @param {number} nodeIndex
 */
function getUpgradeDetails(ns, nodeIndex) {
	const node = ns.hacknet.getNodeStats(nodeIndex);
	const currentGain = ns.formulas.hacknetServers.hashGainRate(node.level, 0, node.ram, node.cores, BITNODE_MULT);
	//Level
	const level = {
		index: nodeIndex,
		type: 'Level',
		stat: 'level',
		cost: ns.hacknet.getLevelUpgradeCost(nodeIndex, 1),
		gain: ns.formulas.hacknetServers.hashGainRate(node.level + 1, 0, node.ram, node.cores, BITNODE_MULT) - currentGain,
		relativeGain: 0
	};
	level.relativeGain = level.gain / level.cost;
	//Ram
	const ram = {
		index: nodeIndex,
		type: 'Ram',
		stat: 'ram',
		cost: ns.hacknet.getRamUpgradeCost(nodeIndex, 1),
		gain: ns.formulas.hacknetServers.hashGainRate(node.level, 0, node.ram + 1, node.cores, BITNODE_MULT) - currentGain,
		relativeGain: 0
	};
	ram.relativeGain = ram.gain / ram.cost;
	//Cores
	const cores = {
		index: nodeIndex,
		type: 'Core',
		stat: 'cores',
		cost: ns.hacknet.getCoreUpgradeCost(nodeIndex, 1),
		gain: ns.formulas.hacknetServers.hashGainRate(node.level, 0, node.ram, node.cores + 1, BITNODE_MULT) - currentGain,
		relativeGain: 0
	};
	cores.relativeGain = cores.gain / cores.cost;
	//Cache
	const cache = {
		index: nodeIndex,
		type: 'Cache',
		stat: 'cache',
		cost: ns.hacknet.getCacheUpgradeCost(nodeIndex, 1),
		gain: 0,
		relativeGain: 0
	};
	return [level, ram, cores, cache];
}

/** @param {NS} ns */
function areAllNodesMaxed(ns) {
	const nodesOwned = ns.hacknet.numNodes();
	if (nodesOwned < MAX_NODES) return false;

	let node;
	for (let i = 0; i < nodesOwned; i++) {
		node = ns.hacknet.getNodeStats(i);
		if (node.cache < MAX_CACHE || node.cores < MAX_CORES || node.ram < MAX_RAM || node.level < MAX_LEVEL) return false;
	}
	return true;
}

/**
 * @param {NS} ns
 * @param {string} target
 */
export function spendHashesToMaxServer(ns, target) {
	while (ns.hacknet.numHashes() > ns.hacknet.hashCost(HASH_STORE.minSecurity, 1) && ns.getServerMinSecurityLevel(target) > 3) {
		ns.hacknet.spendHashes(HASH_STORE.minSecurity, target, 1);
		ns.print(`Lowered ${target}'s minimum security to ${ns.getServerMinSecurityLevel(target).toFixed(1)}`);
	}
	while (ns.hacknet.numHashes() > ns.hacknet.hashCost(HASH_STORE.maxMoney, 1) && ns.getServerMaxMoney(target) < 10e12) {
		ns.hacknet.spendHashes(HASH_STORE.maxMoney, target, 1);
		ns.print(`Increased ${target}'s maximum money to ${ns.formatNumber(ns.getServerMaxMoney(target), 1)}`);
	}
}

/** @param {NS} ns */
function report(ns) {
	//╔═╗╚╝║╠╣╟╢╤╧╪─│┬┴┼▲▼■□
	//Possible width 9.735 * characters
	//Data collection
	const nodesOwned = ns.hacknet.numNodes();
	let node;
	let formattedNode;
	let formattedLevel;
	let formattedCores;
	let formattedCache;
	let formattedRam;
	let formattedHash;
	let totalHashRate = 0;

	//Header
	ns.print('╔══════╤═══════╤═══════╤═══════╤═══════╤════════════╗');
	ns.print('║ Node │ Level │ Cores │ Cache │  Ram  │ Hash Rates ║');
	ns.print('╟──────┼───────┼───────┼───────┼───────┼────────────╢');

	//Dynamic
	for (let i = 0; i < nodesOwned; i++) {
		node = ns.hacknet.getNodeStats(i);
		formattedNode = i.toString().padStart(2, ' ');
		formattedLevel = node.level.toString().padStart(node.level < 10 ? 3 : 4, ' ').padEnd(5, ' ');
		formattedCores = node.cores.toString().padStart(node.cores < 10 ? 3 : 4, ' ').padEnd(5, ' ');
		formattedCache = node.cache.toString().padStart(node.cache < 10 ? 3 : 4, ' ').padEnd(5, ' ');
		formattedRam = ns.formatRam(node.ram, 0).padStart(5, ' ');
		formattedHash = ns.formatNumber(node.production, 2).padStart(6, ' ') + ' h/s';
		totalHashRate += node.production;
		ns.print(`║  ${formattedNode}  │ ${formattedLevel} │ ${formattedCores} │ ${formattedCache} │ ${formattedRam} │ ${formattedHash} ║`);
	}

	//Footer
	const formattedTotalHashes = ns.formatNumber(ns.hacknet.numHashes(), 3).padStart(11, ' ');
	const formattedTotalHashRate = ns.formatNumber(totalHashRate, 3).padStart(9, ' ') + ' h/s';
	ns.print('╠══════╧═╤═════╧═══════╪═══════╧════╤══╧════════════╣');
	ns.print(`║ Hashes │ ${formattedTotalHashes} │ Total Rate │ ${formattedTotalHashRate} ║`);
	ns.print('╚════════╧═════════════╧════════════╧═══════════════╝');

	//Resize
	ns.resizeTail(516, 16 * (8 + nodesOwned));
	compactTail(thisScript);
}