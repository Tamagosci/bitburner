import { formatMoney, formatTime, compactTail } from 'utils.js';

const LOG_SIZE = 51; //Pre-4S forecast will be in 1/(LOG-SIZE-1) increments (ex: 0.05 for 21)
const TRANSACTION_COST = 100_000;
const MIN_TRANSACTION = 50_000_000;
const MIN_BUDGET = 20_000_000;
const BUY_4S_BALANCE = 50_000_000_000;


const NEUTRAL = 0.5;
const PRE_FS_SELL_DELTA = 0;
const PRE_FS_BUY_DELTA = 0.15; //Keep above PRE_FS_SELL_DELTA or it breaks
const FS_SELL_DELTA = 0.05;
const FS_BUY_DELTA = 0.15; //Keep above FS_SELL_DELTA or it breaks

let SHORTS = false;
let FORECAST = false;

/** @param {NS} ns */
export async function main(ns) {
	//WSE and TIXAPI check
	if (!ns.stock.hasWSEAccount() || !ns.stock.hasTIXAPIAccess()) {
		ns.print('ERROR This script needs a WSE account and TIX API to work.');
		return;
	}

	//Logging setup
	ns.disableLog('ALL');
	ns.tail();
	await ns.sleep(0);
	ns.moveTail(1957, 696);

	//Check shorts access
	try {
		ns.stock.buyShort('JGN', 0);
		SHORTS = true;
		ns.print('INFO: Running with shorts on.');
	}
	catch {
		ns.print('WARN: Running with shorts off.');
	}

	const stonks = [];

	let [sellAll = false] = ns.args;
	let counter = 0;

	//4S check
	FORECAST = ns.stock.has4SDataTIXAPI();
	if (!FORECAST)
		ns.printf('WARN: Running in Pre-4S mode, it will take %s minutes to start up.', (LOG_SIZE / 10).toFixed(1));

	//Main loop 
	while (true) {
		//Report activation in case of no 4s
		if (!FORECAST && ++counter === LOG_SIZE)
			ns.print('SUCCESS Reached required log size: starting to trade.');

		//Update stock prices
		updateStonks(ns, stonks);

		//Sell stocks
		sellStonks(ns, stonks, sellAll);
		if (sellAll) break;

		//Try buying 4S
		if (!FORECAST && ns.getPlayer().money >= BUY_4S_BALANCE) {
			FORECAST = ns.stock.purchase4SMarketDataTixApi();
			if (FORECAST) ns.print('WARN: Purchased 4S API, switching to 4S mode.');
		}

		//Buy stocks
		buyStonks(ns, stonks);

		//Report progress
		report(ns, stonks);

		//Sleep
		await ns.sleep(6000);
	}
}

/**
 * @param {NS} ns
 * @param {Stonk[]} stonks
 */
function updateStonks(ns, stonks) {
	const symbols = ns.stock.getSymbols();
	for (const sym of symbols) {
		let entry = stonks.find(stonk => stonk.sym == sym);
		if (entry == undefined) {
			entry = new Stonk(sym);
			stonks.push(new Stonk(sym));
		}
	}
	for (const stonk of stonks)
		stonk.update(ns);
}

/**
 * @param {NS} ns
 * @param {Stonk[]} stonks
 * @param {boolean} sellAll
 * @return {boolean}
 */
function sellStonks(ns, stonks, sellAll) {
	let soldAnything = false;
	//Longs
	for (const stonk of stonks) {
		//Skip if no longs owned
		if (stonk.ownedLongs === 0) continue;
		//Skip if forecast is still positive and not dumping
		if (stonk.forecast >= NEUTRAL + ((FORECAST) ? FS_SELL_DELTA : PRE_FS_SELL_DELTA) && !sellAll) continue;
		//Report sale
		ns.printf('INFO: Selling %s LONG shares of %s for $%s (%s profit)',
			formatMoney(stonk.ownedLongs), stonk.sym, formatMoney(stonk.GetValue()), ns.formatPercent(stonk.GetPercentProfit()));
		//Sell
		ns.stock.sellStock(stonk.sym, stonk.ownedLongs);
		soldAnything = true;
	}
	//Shorts
	if (!SHORTS) return soldAnything;
	for (const stonk of stonks) {
		//Skip if no shorts owned
		if (stonk.ownedShorts === 0) continue;
		//Skip if forecast is still negative and not dumping
		if (stonk.forecast <= NEUTRAL - ((FORECAST) ? FS_SELL_DELTA : PRE_FS_SELL_DELTA) && !sellAll) continue;
		//Report sale
		ns.printf('INFO: Selling %s SHORT shares of %s for $%s (%s profit)',
			formatMoney(stonk.ownedShorts), stonk.sym, formatMoney(stonk.GetValue()), ns.formatPercent(stonk.GetPercentProfit()));
		//Sell
		ns.stock.sellShort(stonk.sym, stonk.ownedShorts);
		soldAnything = true;
	}
	return soldAnything;
}

/**
 * @param {NS} ns
 * @param {Stonk[]} stonks
 * @return {boolean}
 */
function buyStonks(ns, stonks) {
	//Filter for only good stonks
	const buying = stonks.filter(stonk => stonk.normalizedForecast >= NEUTRAL + ((FORECAST) ? FS_BUY_DELTA : PRE_FS_BUY_DELTA));
	//Sort to buy best first
	buying.sort((a, b) => b.normalizedForecast * (1 + b.volatility) - a.normalizedForecast * (1 + a.volatility));
	//Get budget
	let budget = ns.getServerMoneyAvailable('home');
	//Stop if out of money
	if (budget < MIN_BUDGET) return;
	//Cycle stocks
	let boughtAnything = false;
	for (const stonk of buying) {
		//Skip short if shorts aren't available
		const isShort = stonk.forecast < NEUTRAL;
		if (!SHORTS && isShort) continue;
		//Calculate how many shares can be bought
		const maxShares = ns.stock.getMaxShares(stonk.sym) - stonk.ownedLongs - stonk.ownedShorts;
		const sharePrice = stonk.forecast < NEUTRAL ? stonk.bidPrice : stonk.askPrice;
		const sharesToBuy = Math.min(maxShares, Math.floor((budget - TRANSACTION_COST) / sharePrice));
		const totalPrice = sharesToBuy * sharePrice + TRANSACTION_COST;
		//Skip if not enough money
		if (sharesToBuy === 0) continue;
		//Skip if below MIN_TRANSACTION
		if (totalPrice < MIN_TRANSACTION) continue;
		//Report purchase
		budget -= totalPrice;
		const type = (isShort) ? 'SHORT' : 'LONG';
		ns.printf('INFO: Buying %s %s shares of %s for $%s',
			formatMoney(sharesToBuy), type, stonk.sym, formatMoney(totalPrice));
		//Buy shares
		if (isShort)
			ns.stock.buyShort(stonk.sym, sharesToBuy);
		else
			ns.stock.buyStock(stonk.sym, sharesToBuy);
		boughtAnything = true;
	}
	return boughtAnything;
}

/** @param {NS} ns */
function report(ns, stonks) {
	//╔═╗╚╝║╟╢╤╧╪─│┬┴┼▲▼
	const stats = ns.getRunningScript();
	const secondsPassed = stats.onlineRunningTime;
	const totalIncome = stats.onlineMoneyMade;
	const income = totalIncome / secondsPassed;
	//Counters
	let totalValue = 0;
	let totalProfit = 0;
	//Header
	let formattedTime = formatTime(secondsPassed * 1000);
	formattedTime = formattedTime.padStart(Math.ceil((13 + formattedTime.length) / 2), ' ').padEnd(13, ' ');
	ns.print('╔═══════════════╤═════════╤═══════════╤══════════╤═══════════╗')
	ns.print(`║ ${formattedTime} │  Owned  │   Value   │  Profit  │  Profit%  ║`)
	ns.print('╟───────┬───────┼─────────┼───────────┼──────────┼───────────╢')
	//Dynamic
	for (const stonk of stonks) {
		const name = stonk.sym.padEnd(5, ' ');
		let forecast = ''.padStart(5, ' ');
		let owned = ''.padStart(7, ' ');
		let value = ''.padStart(9, ' ');
		let profitFlat = ''.padStart(8, ' ');
		let profitPercent = ''.padStart(9, ' ');
		//Longs
		if (stonk.ownedLongs > 0)
			owned = formatMoney(stonk.ownedLongs, 2).padStart(7, ' ');
		//Shorts
		else if (stonk.ownedShorts > 0)
			owned = formatMoney(stonk.ownedShorts, 2).padStart(7, ' ');
		//Either
		if (owned[owned.length - 1] != ' ') {
			//Counters
			totalValue += stonk.GetValue();
			totalProfit += stonk.GetProfit();
			//Print
			const symbolCount = Math.min((stonk.normalizedForecast - NEUTRAL) / 0.05, 5);
			const symbolType = (stonk.forecast > NEUTRAL) ? '+' : '-';
			forecast = ''.padStart(Math.max(symbolCount, 1), symbolType).padStart(5, ' ');
			value = ('$' + formatMoney(stonk.GetValue(), 2)).padStart(9, ' ');
			profitFlat = stonk.GetProfit();
			profitFlat = (profitFlat < 0)
				? profitFlat = ('-$' + formatMoney(-profitFlat)).padStart(8, ' ')
				: profitFlat = ('$' + formatMoney(profitFlat)).padStart(8, ' ');
			profitPercent = ns.formatPercent(stonk.GetPercentProfit(), 0, 10).padStart(7, ' ').padEnd(9, ' ');
		}
		ns.print(`║ ${name} │ ${forecast} │ ${owned} │ ${value} │ ${profitFlat} │ ${profitPercent} ║`);
	}
	//Footer
	totalValue = (totalValue < 0)
		? totalValue = ('-$' + formatMoney(-totalValue, 2)).padStart(9, ' ')
		: totalValue = ('$' + formatMoney(totalValue, 2)).padStart(9, ' ');
	totalProfit = (totalProfit < 0)
		? totalProfit = ('-$' + formatMoney(-totalProfit)).padStart(8, ' ')
		: totalProfit = ('$' + formatMoney(totalProfit)).padStart(8, ' ');
	const formattedIncome = (formatMoney(income, (income >= 0) ? 1 : 0) + '$/s').padStart(9, ' ');
	ns.print('╟───────┴───────┴─────────┼───────────┼──────────┼───────────╢');
	ns.print(`║    Total Stock Value    │ ${totalValue} │ ${totalProfit} │ ${formattedIncome} ║`);
	ns.print('╚═════════════════════════╧═══════════╧══════════╧═══════════╝');
	//Need to resize if closed and reopened
	ns.resizeTail(601, 656);
	//Compact
	compactTail(ns.getScriptName());
}

export class Stonk {
	/**
	 * @param {NS} ns
	 * @param {string} sym
	 */
	constructor(sym) {
		this.sym = sym;
		this.log = [];
	}

	/** @param {NS} ns */
	update(ns) {
		//Stock metrics
		this.askPrice = ns.stock.getAskPrice(this.sym);
		this.bidPrice = ns.stock.getBidPrice(this.sym);
		this.price = ns.stock.getPrice(this.sym);
		this.maxShares = ns.stock.getMaxShares(this.sym);
		//Keep log
		this.log.push(this.price);
		if (this.log.length > LOG_SIZE) this.log.shift();
		//Get current position
		const [ownedLongs, avgLongPrice, ownedShorts, avgShortPrice] = ns.stock.getPosition(this.sym);
		this.ownedLongs = ownedLongs;
		this.avgLongPrice = avgLongPrice;
		this.ownedShorts = ownedShorts;
		this.avgShortPrice = avgShortPrice;
		//Get forecast
		if (FORECAST) {
			this.forecast = ns.stock.getForecast(this.sym);
			this.volatility = ns.stock.getVolatility(this.sym);
			//Shorts are worse than longs, we account for that here
			if (this.ownedShorts > this.ownedLongs)
				this.volatility /= 2;
		}
		else {
			//Forecast estimation if 4S isn't available
			let increases = 0;
			for (let i = 1; i < this.log.length; i++) {
				const previous = this.log[i - 1];
				const current = this.log[i];
				if (current > previous) increases++;
			}
			if (this.log.length === LOG_SIZE)
				this.forecast = increases / (LOG_SIZE - 1); //-1 because with x logs we get x-1 comparisons
			else
				this.forecast = NEUTRAL; //If we're not sure it's basically 50/50
			this.volatility = 0;
		}
		this.normalizedForecast = (this.forecast < NEUTRAL)
			? 1 - this.forecast
			: this.forecast;
	}

	GetPricePaid() {
		const longCost = this.ownedLongs * this.avgLongPrice;
		const shortCost = this.ownedShorts * this.avgShortPrice;
		return longCost + shortCost;
	}

	GetValue() {
		const longValue = this.ownedLongs * this.bidPrice;
		const shortValue = this.ownedShorts * this.askPrice;
		return longValue + shortValue;
		return
	}

	GetProfit() {
		// Long stocks sell for Bid price.
		const longProfit = this.ownedLongs * this.bidPrice - this.ownedLongs * this.avgLongPrice;
		// Short stocks sell for Ask price.
		const shortProfit = this.ownedShorts * this.avgShortPrice - this.ownedShorts * this.askPrice;
		return longProfit + shortProfit;
	}

	GetPercentProfit() {
		//return this.GetProfit() / this.GetPricePaid();
		return this.GetValue() / this.GetPricePaid() - 1;
	}
}