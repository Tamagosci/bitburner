import { formatMoney, getServerSymbols } from 'utils.js';
import { prime, weakenToMin } from 'primer.js';
import { Stonk } from 'stock.js';

const TRANSACTION_COST = 100_000;
const MIN_TRANSACTION = 50_000_000;
const BUDGET = 0.8;

const CYCLE_DURATION = 600e3;

let HOST = 'home';
let MAX_RAM = 32;
let SHORTS_AVAILABLE = false;

/** @param {NS} ns */
export async function main(ns) {
	let [target] = ns.args;
	await manipulate(ns, target);
}

/**
 * @param {NS} ns
 * @param {string} target
 */
async function manipulate(ns, target) {
	//Logging
	ns.disableLog('ALL');
	ns.tail();
	await ns.sleep(0); //Required to make resizeTail work
	ns.resizeTail(600, 300);

	//Check target viability
	if (ns.serverExists(target) == false) {
		ns.tprintf('ERROR There is no server called %s!', target);
		return;
	}
	else if (ns.getServerRequiredHackingLevel(target) > ns.getHackingLevel()) {
		ns.tprint('ERROR The specified server\'s hacking level requirement is too high!');
		return;
	}
	const sym = getServerSymbols()[target];
	if (sym === undefined) {
		ns.tprintf('ERROR Server %s does not have an associated symbol!', target);
		return;
	}

	//Constants
	HOST = ns.getHostname();
	MAX_RAM = ns.getServerMaxRam(HOST);
	const stonk = new Stonk(sym);

	//Check if shorts are available
	try {
		ns.stock.buyShort('JGN', 0);
		SHORTS_AVAILABLE = true;
		ns.print('INFO: Running with shorts on.');
	}
	catch {
		ns.print('WARN: Running with shorts off.');
	}

	//Main loop
	do {
		
	} while (false);
}

/**
 * @param {NS} ns
 * @param {string} target
 */
async function down(ns, target) {
	//Collision compensation
	await prime(ns, target);
	//Data gathering
	const primed = ns.getServer(target);
	const targetMoney = primed.moneyMax * HACK_TARGET;
	const sleepTime = ns.getWeakenTime(target) + 20;
	//Thread calculation
	const hackPercent = ns.formulas.hacking.hackPercent(primed, ns.getPlayer());
	const totalHackThreads = Math.floor((1 - HACK_TARGET) / hackPercent);
	const threadsRatio = ns.weakenAnalyze(1) / ns.hackAnalyzeSecurity(1);
	const totalWeakenThreads = Math.ceil(totalHackThreads * threadsRatio);
	const cycles = Math.ceil((totalHackThreads + totalWeakenThreads) / (threadsRatio + 1));
	//Lower forecast
	ns.printf('INFO Starting %s DOWN cycles for a total of %s hack and %s weaken threads.', cycles, totalHackThreads, totalWeakenThreads);
	ns.printf('Sleeping for %s minutes while they complete.', (sleepTime * cycles / 60e3).toFixed(1));
	while (ns.getServerMoneyAvailable(target) > targetMoney) {
		ns.run('hack.js', threadsRatio, target, 0, true);
		ns.run('weaken.js', 2, target);
		await ns.sleep(sleepTime);
	}
}

/**
 * @param {NS} ns
 * @param {string} target
 */
async function up(ns, target) {
	//Collision compensation
	await prime(ns, target);
	//Data gathering
	const primed = ns.getServer(target);
	const sleepTime = ns.getWeakenTime(target) + 20;
	//Thread calculation
	const totalGrowThreads = Math.ceil(ns.formulas.hacking.growThreads(primed, ns.getPlayer(), primed.moneyMax));
	const threadsRatio = ns.growthAnalyzeSecurity(1) / ns.weakenAnalyze(1);
	const totalWeakenThreads = Math.ceil(totalGrowThreads * threadsRatio);
	const cycles = Math.ceil((totalGrowThreads + totalWeakenThreads) / (threadsRatio + 1));
	//Raise forecast
	ns.printf('INFO Starting %s UP cycles for a total of %s grow and %s weaken threads.', cycles, totalGrowThreads, totalWeakenThreads);
	ns.printf('Sleeping for %s minutes while they complete.', (sleepTime * cycles / 60e3).toFixed(1));
	while (ns.getServerMoneyAvailable(target) < primed.moneyMax) {
		ns.run('grow.js', threadsRatio, target, 0, true);
		ns.run('weaken.js', 2, target);
		await ns.sleep(sleepTime);
	}
}

/**
 * @param {NS} ns
 * @param {Stonk} stonk
 * @param {'long'|'short'} position
 * @return {boolean}
 */
function buyShares(ns, stonk, position) {
	//Calculate available budget
	const budget = ns.getServerMoneyAvailable('home') * BUDGET;
	if (budget < MIN_TRANSACTION) {
		ns.print('WARN Skipping buy segment due to insufficient founds.');
		return false;
	}
	//Calculate shares to buy
	stonk.update(ns);
	const maxShares = ns.stock.getMaxShares(stonk.sym) - stonk.ownedLongs - stonk.ownedShorts;
	const sharePrice = (position === 'long') ? stonk.askPrice : stonk.bidPrice;
	const sharesToBuy = Math.min(maxShares, Math.floor((budget - TRANSACTION_COST) / sharePrice));
	const totalPrice = sharesToBuy * sharePrice + TRANSACTION_COST;
	//Safety checks
	if (totalPrice < MIN_TRANSACTION || sharesToBuy === 0) return false;
	//Purchase shares
	if (position === 'long') {
		ns.printf('WARN Buying %s LONG shares of %s for $%s',
			formatMoney(sharesToBuy), stonk.sym, formatMoney(totalPrice));
		ns.stock.buyStock(stonk.sym, sharesToBuy);
	}
	else if (position === 'short') {
		ns.printf('WARN Buying %s SHORT shares of %s for $%s',
			formatMoney(sharesToBuy), stonk.sym, formatMoney(totalPrice));
		ns.stock.buyShort(stonk.sym, sharesToBuy);
	}
	return true;
}

/**
 * @param {NS} ns
 * @param {Stonk} stonk
 * @return {boolean}
 */
function buyShorts(ns, stonk) {
	//Calculate available budget
	const budget = ns.getServerMoneyAvailable('home') * BUDGET;
	if (budget < MIN_TRANSACTION) {
		ns.print('WARN Skipping buy segment due to insufficient founds.');
		return false;
	}
	//Calculate shares to buy
	stonk.update(ns);
	const maxShares = ns.stock.getMaxShares(stonk.sym) - stonk.ownedShorts;
	const sharePrice = stonk.bidPrice;
	const sharesToBuy = Math.min(maxShares, Math.floor((budget - TRANSACTION_COST) / sharePrice));
	const totalPrice = sharesToBuy * sharePrice + TRANSACTION_COST;
	//Safety checks
	if (totalPrice < MIN_TRANSACTION || sharesToBuy === 0) return false;
	//Purchase shares
	ns.printf('WARN Buying %s SHORT shares of %s for $%s',
		formatMoney(sharesToBuy), stonk.sym, formatMoney(totalPrice));
	ns.stock.buyShort(stonk.sym, sharesToBuy);
	return true;
}

/**
 * @param {NS} ns
 * @param {Stonk} stonk
 * @return {boolean}
 */
function buyLongs(ns, stonk) {
	//Calculate available budget
	const budget = ns.getServerMoneyAvailable('home') * BUDGET;
	if (budget < MIN_TRANSACTION) {
		ns.print('WARN Skipping buy segment due to insufficient founds.');
		return false;
	}
	//Calculate shares to buy
	stonk.update(ns);
	const maxShares = ns.stock.getMaxShares(stonk.sym) - stonk.ownedLongs;
	const sharePrice = stonk.askPrice;
	const sharesToBuy = Math.min(maxShares, Math.floor((budget - TRANSACTION_COST) / sharePrice));
	const totalPrice = sharesToBuy * sharePrice + TRANSACTION_COST;
	//Safety checks
	if (totalPrice < MIN_TRANSACTION || sharesToBuy === 0) return false;
	//Purchase shares
	ns.printf('WARN Buying %s LONG shares of %s for $%s',
		formatMoney(sharesToBuy), stonk.sym, formatMoney(totalPrice));
	ns.stock.buyStock(stonk.sym, sharesToBuy);
	return true;
}

/**
 * @param {NS} ns
 * @param {Stonk} stonk
 * @return {boolean}
 */
function sellShorts(ns, stonk) {
	//Safety checks
	stonk.update(ns);
	if (stonk.ownedShorts === 0) return false;
	//Report sale
	ns.printf('WARN Selling %s SHORT shares of %s for $%s (%s profit)',
		formatMoney(stonk.ownedShorts), stonk.sym, formatMoney(stonk.GetValue()), ns.formatPercent(stonk.GetPercentProfit()));
	ns.stock.sellShort(stonk.sym, stonk.ownedShorts);
	return true;
}

/**
 * @param {NS} ns
 * @param {Stonk} stonk
 * @return {boolean}
 */
function sellLongs(ns, stonk) {
	//Safety checks
	stonk.update(ns);
	if (stonk.ownedLongs === 0) return false;
	//Report sale
	ns.printf('WARN Selling %s LONG shares of %s for $%s (%s profit)',
		formatMoney(stonk.ownedLongs), stonk.sym, formatMoney(stonk.GetValue()), ns.formatPercent(stonk.GetPercentProfit()));
	ns.stock.sellStock(stonk.sym, stonk.ownedLongs);
	return true;
}