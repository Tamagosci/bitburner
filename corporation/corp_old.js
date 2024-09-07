import { getCities, formatMoney, compactTail } from 'utils.js';

const INDUSTRIES = {
	agriculture: 'Agriculture',
	tobacco: 'Tobacco',
	healthcare: 'Healthcare'
};

const POSITIONS = {
	operations: 'Operations',
	engineer: 'Engineer',
	business: 'Business',
	management: 'Management',
	rnd: 'Research & Development',
	training: 'Training',
	unassigned: 'Unassigned'
}

const MATERIALS = {
	water: 'Water',
	energy: 'Energy',
	food: 'Food',
	plants: 'Plants',
	hardware: 'Hardware',
	robots: 'Robots',
	cores: 'AI Cores',
	estate: 'Real Estate'
};

const UPGRADES = {
	SF: 'Smart Factories',
	WA: 'Wilson Analytics',
	NA: 'Neural Accelerators',
	PI: 'Project Insight',
	SS: 'Smart Storage',
	NNII: 'Nuoptimal Nootropic Injector Implants',
	FW: 'FocusWires',
	DS: 'DreamSense',
	SPI: 'Speech Processor Implants',
	SB: 'ABC SalesBots'
};

const RESEARCH = {
	lab: 'Hi-Tech R&D Laboratory',
	autobrew: 'AutoBrew',
	autoparty: 'AutoPartyManager',
	autodrug: 'Automatic Drug Administation',
	juice: 'Go-Juice',
	injections: 'CPH4 Injections',
	bulk: 'Bulk Purchasing',
	drones: 'Drones',
	droneAssembly: 'Drones - Assembly',
	droneTransport: 'Drones - Transport',
	buddyRecruit: 'HRBuddy-Recruitment',
	buddyTraining: 'HRBuddy-Training',
	joywire: 'JoyWire',
	marketI: 'Market-TA.I',
	marketII: 'Market-TA.II',
	overclock: 'Overclock',
	stimu: 'Sti.mu',
	assemblers: 'Self-Correcting Assemblers',
	fulcrum: 'uPgrade: Fulcrum',
	capacity: 'uPgrade: Capacity.I',
	dashboard: 'uPgrade: Dashboard'
};

const DONT_RESEARCH = [RESEARCH.buddyRecruit, RESEARCH.buddyTraining];
const REQ_RESEARCH = [RESEARCH.lab, RESEARCH.marketI, RESEARCH.marketII];

const COMPANY = 'Jormungandr';
const AGRI = 'Eden';
const TOBA = 'Sikar';
const CARE = 'Dhanvantari';
const SUM = 'SUM';
const MAX = 'MAX';
const MP = 'MP';
const HQ = 'Aevum';

const INVESTOR_THRESHOLDS = [450e9, 5e12, 1e15, 1e18];
const HQ_RATIO = [3, 5, 2, 5, 6, 0, 0]; //Same order as POSITIONS
HQ_RATIO[SUM] = HQ_RATIO.reduce((a, b) => a + b);
const MIN_RESEARCH = 100e3;
const MIN_EMPLOYEES = 9;
const MAX_HQ_EMPLOYEES = HQ_RATIO[SUM] * 20;
const MAX_SUB_EMPLOYEES = 204;
const MIN_VALUATION_MULT = 0.2;
const SLEEP = 12e3;

/** @type {string[]} */
const CITIES = getCities();
/** @type {string[]} */
const DIVISIONS = [];
/** @type {{string: number}} */
const PRODUCT_COUNT = {};
/** @type {{string: boolean}} */
const RESEARCHED_ALL = {};

/** @type {Corporation} */
let corp;
/** @type {CorpConstants} */
let CONSTANTS;
let purchasedAllUnlocks = false;
let scriptName = 'corp.js';

/** @param {NS} ns */
export async function main(ns) {
	//Logging
	ns.disableLog('ALL');
	ns.tail();
	await ns.sleep(0);

	//Load stuff
	corp = ns.corporation;
	CONSTANTS = corp.getConstants();
	scriptName = ns.getScriptName();
	const allDivisions = corp.getCorporation().divisions;
	ns.moveTail(1957, 60 - (16 * allDivisions.length));
	ns.resizeTail(516, 16 * (12 + allDivisions.length));

	for (const division of allDivisions) {
		if (startup(ns, division)) {
			DIVISIONS.push(division)
			RESEARCHED_ALL[division] = false;
		}
		else
			ns.printf('WARN Unable to enter maintenance mode for division %s.', division);
	}

	if (DIVISIONS.length === 0) {
		ns.print('ERROR No valid divisions found, shutting down.');
		return;
	}

	await mantain(ns);
}

/** @param {NS} ns */
async function mantain(ns) {
	//Initialization
	const notHQ = CITIES.find(c => c != HQ);
	const lastProducts = {};
	for (const division of DIVISIONS)
		lastProducts[division] = division + '-' + (PRODUCT_COUNT[division] - 1).toString();
	const valuationMultiplier = Math.max(ns.getBitNodeMultipliers().CorporationValuation, MIN_VALUATION_MULT);

	while (true) {
		while (corp.getCorporation().state != "START") {
			await ns.sleep(500);
		}
		while (corp.getCorporation().state == "START") {
			//-------------------------------------------------------
			//    <<Things to be done multiple times per cycle>>
			//-------------------------------------------------------

			for (const division of DIVISIONS) {
				//Buy one Wilson Analytics level
				if (corp.getCorporation().funds > corp.getUpgradeLevelCost(UPGRADES.WA))
					corp.levelUpgrade(UPGRADES.WA);

				//Hire HQ
				const hireCostHQ = corp.getOfficeSizeUpgradeCost(division, HQ, HQ_RATIO[SUM]);
				//But not too many
				if (corp.getOffice(division, HQ).size < MAX_HQ_EMPLOYEES
					&& corp.getCorporation().funds >= hireCostHQ) {
					corp.upgradeOfficeSize(division, HQ, HQ_RATIO[SUM]);
					for (let i = 0; i < CONSTANTS.employeePositions.length; i++)
						for (let o = 0; o < HQ_RATIO[i]; o++)
							corp.hireEmployee(division, HQ, CONSTANTS.employeePositions[i]);
				}
				//Buy advert if HR too expensive
				else if (corp.getCorporation().funds > corp.getHireAdVertCost(division))
					corp.hireAdVert(division);

				//Hire subsidiaries
				const hireCostSubs = corp.getOfficeSizeUpgradeCost(division, notHQ, 1) * 5;
				//But not too many
				if (corp.getOffice(division, notHQ).size < corp.getOffice(division, HQ).size - 60
					&& corp.getOffice(division, notHQ).size < MAX_SUB_EMPLOYEES
					&& corp.getCorporation().funds >= hireCostSubs) {
					for (const city of CITIES.filter(c => c != HQ)) {
						corp.upgradeOfficeSize(division, city, 1);
						corp.hireEmployee(division, city, POSITIONS.rnd);
					}
				}

				//Upgrade warehouse
				const warehouseCost = corp.getUpgradeWarehouseCost(division, HQ, 1) * 6;
				if (corp.getCorporation().funds >= warehouseCost)
					for (const city of CITIES)
						corp.upgradeWarehouse(division, city, 1);
			}

			//Buy various upgrades
			buyUpgrades(ns);
			await ns.sleep(50);
		}
		//---------------------------------------------
		//    <<Things to be done once per cycle>>
		//---------------------------------------------

		for (const division of DIVISIONS) {
			//Buy research
			buyResearch(ns, division);
			
			//Check if product in development is finished
			if (corp.getProduct(division, lastProducts[division]).developmentProgress === 100) {
				ns.printf('SUCCESS Product %s completed!', lastProducts[division]);
				await onProductDesigned(ns, division, lastProducts[division]);
				lastProducts[division] = await createProduct(ns, division);
			}
		}

		//Accept investments and/or go public
		if (corp.getCorporation().public === false) {
			const investment = corp.getInvestmentOffer();
			if (investment.funds >= INVESTOR_THRESHOLDS[investment.round - 1] * valuationMultiplier) {
				if (corp.acceptInvestmentOffer() && investment.round === 4) {
					//Go public and set dividends
					corp.goPublic(0);
					corp.issueDividends(0.01);
					ns.print('SUCCESS Went public!');
				}
			}
		}

		//Update table
		report(ns);
	}
}

/** @param {NS} ns */
function startup(ns, division) {
	//Check if we have a corp
	if (corp.hasCorporation() === false)
		return false

	//Check if we have division
	if (corp.getCorporation().divisions.includes(division) === false)
		return false;

	//Check if it makes products
	if (ns.corporation.getDivision(division).makesProducts === false)
		return false;

	//Check if we have all cities
	const expandedCities = corp.getDivision(division).cities;
	if (expandedCities.length < CITIES.length) {
		for (const city of CITIES) {
			if (expandedCities.includes(city) === false) {
				try { corp.expandCity(division, city); }
				catch { return false; }
			}
		}
	}

	//Check if we have minimum personnel and warehouse
	for (const city of CITIES) {
		const office = corp.getOffice(division, city);
		if (office.size < MIN_EMPLOYEES) {
			try { corp.upgradeOfficeSize(division, city, MIN_EMPLOYEES - office.size); }
			catch { return false; }
		}
		if (corp.hasWarehouse(division, city) === false) {
			try { corp.purchaseWarehouse(division, city); }
			catch { return false; }
		}
	}

	//Make sure employees are assigned properly
	for (const city of CITIES) {
		//Unassign all
		for (const position of corp.getConstants().employeePositions)
			corp.setAutoJobAssignment(division, city, position, 0);
		//Make sure all slots are filled
		while (corp.getOffice(division, city).employees < corp.getOffice(division, city).size)
			corp.hireEmployee(division, city);
		//Get employees count
		let employees = corp.getOffice(division, city).employees;

		//Non HQ go [1, 1, 1, 1, x, 0]
		if (city != HQ) {
			corp.setAutoJobAssignment(division, city, POSITIONS.operations, 1);
			corp.setAutoJobAssignment(division, city, POSITIONS.engineer, 1);
			corp.setAutoJobAssignment(division, city, POSITIONS.business, 1);
			corp.setAutoJobAssignment(division, city, POSITIONS.management, 1);
			employees -= 4;
			corp.setAutoJobAssignment(division, city, POSITIONS.rnd, employees);
		}
		//HQ goes HQ_RATIO
		else {
			if (employees % HQ_RATIO[SUM] > 0) {
				let difference = HQ_RATIO[SUM] - employees % HQ_RATIO[SUM];
				employees += difference;
				corp.upgradeOfficeSize(division, city, difference);
				while (difference-- > 0)
					corp.hireEmployee(division, city);
			}
			const mult = Math.floor(employees / HQ_RATIO[SUM]);
			for (let i = 0; i < CONSTANTS.employeePositions.length; i++)
				corp.setAutoJobAssignment(division, HQ, CONSTANTS.employeePositions[i], HQ_RATIO[i] * mult);
		}
	}

	//Get the product counter up to current count
	const div = corp.getDivision(division);
	if (div.products.length === 0) return false;
	const lastDigits = div.products.map(product => parseInt(product.split('-')[1]));
	PRODUCT_COUNT[division] = Math.max(...lastDigits) + 1;
	ns.printf('Resuming %s production from product %s.', division, PRODUCT_COUNT[division]);

	//TODO: set material sell to MAX/MP for material+product divisions
	/*
	switch (div.type) {
		default:
			break;
	}
	*/

	//Checks completed
	return true;
}

/** @param {NS} ns */
async function createProduct(ns, division) {
	//Calculate funding
	const div = corp.getDivision(division);
	const profit = div.lastCycleRevenue - div.lastCycleExpenses;
	//Pick highest between 1b, 1 minute of income or 2.5% funds
	const funds = Math.max(1e9, profit * 6, corp.getCorporation().funds * 0.025);
	//Wait for funds, 2x because design + marketing
	while (corp.getCorporation().funds < funds * 2)
		await ns.sleep(SLEEP);
	//Pick a name
	const product = division + '-' + (PRODUCT_COUNT[division]++).toString();
	corp.makeProduct(division, HQ, product, funds, funds);
	ns.printf('Started developing product %s.', product);
	//Return name
	return product;
}

/** @param {NS} ns */
async function onProductDesigned(ns, division, product) {
	//Start selling it
	let optimalPrice = MP;
	if (ns.corporation.hasResearched(division, RESEARCH.marketII))
		corp.setProductMarketTA2(division, product, true);
	else
		optimalPrice = await findSellPrice(ns, division, product);
	corp.sellProduct(division, HQ, product, MAX, optimalPrice, true);
	ns.printf('INFO Started selling product %s.', product);
	//Get rid of worst one
	const products = corp.getDivision(division).products;
	if (products.length >= ((RESEARCHED_ALL[division]) ? 4 : 3)) {
		const ratings = products.map(product => corp.getProduct(division, product).rat);
		const discontinue = products[ratings.indexOf(Math.min(...ratings))];
		corp.discontinueProduct(division, discontinue);
		ns.printf('WARN Discontinued product %s.', discontinue);
	}
}

/** @param {NS} ns */
async function findSellPrice(ns, division, product) {
	ns.print('Finding sell price of ' + product);
	let mult = 1;
	let stable = true;
	while (stable) {
		const price = MP + '*' + mult.toString();
		mult *= 2;
		ns.corporation.sellProduct(division, HQ, product, MAX, price, true);
		await ns.sleep(10e3);
		const [inventory, produced, sold] = ns.corporation.getProduct(division, product).cityData[HQ];
		stable = (sold.toFixed(3) == produced.toFixed(3));
	}
	mult = Math.max(mult / 4, 1);
	return MP + '*' + mult.toString();
}

/** @param {NS} ns */
function buyUpgrades(ns) {
	//Infinite upgrades
	const upgrades = CONSTANTS.upgradeNames;
	upgrades.sort((a, b) => ns.corporation.getUpgradeLevelCost(a) - ns.corporation.getUpgradeLevelCost(b));
	for (const upgrade of upgrades) {
		if (ns.corporation.getCorporation().funds > ns.corporation.getUpgradeLevelCost(upgrade) * 2)
			ns.corporation.levelUpgrade(upgrade);
		else break;
	}
	//One-timers
	if (purchasedAllUnlocks) return;
	const unlocks = CONSTANTS.unlockNames.filter(unlock => ns.corporation.hasUnlockUpgrade(unlock) === false);
	unlocks.sort((a, b) => ns.corporation.getUnlockUpgradeCost(a) - ns.corporation.getUnlockUpgradeCost(b));
	for (const unlock of unlocks) {
		if (ns.corporation.getCorporation().funds > ns.corporation.getUnlockUpgradeCost(unlock) * 2) {
			ns.corporation.unlockUpgrade(unlock);
			ns.print('INFO Unlocked ' + unlock);
		}
		else break;
	}
	purchasedAllUnlocks = unlocks.every(unlock => ns.corporation.hasUnlockUpgrade(unlock));
}

/** @param {NS} ns */
function buyResearch(ns, division) {
	if (RESEARCHED_ALL[division]) return;
	const allResearch = CONSTANTS.researchNames;
	const missingResearch = allResearch.filter(res => DONT_RESEARCH.includes(res) === false && ns.corporation.hasResearched(division, res) === false);
	missingResearch.sort((a, b) => ns.corporation.getResearchCost(division, a) - ns.corporation.getResearchCost(division, b));
	missingResearch.sort((a, b) => {
		if (REQ_RESEARCH.includes(a)) return (REQ_RESEARCH.includes(b)) ? 0 : -1;
		else return 0;
	}); //Priorities first
	for (const res of missingResearch) {
		const threshold = (res == RESEARCH.lab)
			? ns.corporation.getResearchCost(division, res) * 2 // <--- This is to get 10% bonus research ASAP
			: ns.corporation.getResearchCost(division, res) + MIN_RESEARCH;
		if (ns.corporation.getDivision(division).research > threshold) {
			ns.corporation.research(division, res);
			ns.printf('INFO Researched %s for division %s.', res, division);
		}
		else
			break; //Not enough research points
	}
	RESEARCHED_ALL[division] = missingResearch.every(res => ns.corporation.hasResearched(division, res));
}

/** @param {NS} ns */
function report(ns) {
	//╔═╗╚╝║╠╣╟╢╤╧╪─│┬┴┼▲▼■□
	//Header
	ns.print('╔═════════════╤══════════╤════════════╤═════════════╗');
	ns.print('║ Jormungandr │ Research │ Net Profit │ Development ║');
	ns.print('╟─────────────┼──────────┼────────────┼─────────────╢');
	//Dynamic
	const corpo = ns.corporation.getCorporation();
	for (const name of corpo.divisions) {
		const division = ns.corporation.getDivision(name);
		const paddedDivision = name.padStart(Math.ceil((11 - name.length) / 2 + name.length), ' ').padEnd(11, ' ');
		const research = formatMoney(division.research, 3).padStart(8, ' ');
		const profit = division.lastCycleRevenue - division.lastCycleExpenses;
		const formattedProfit = formatMoney(profit, 3).padStart(10, ' ');
		const lastProduct = division.products[division.products.length - 1];
		let productProgression = (lastProduct === undefined)
			? '[/////////]'
			: `[${''.padStart(Math.floor(ns.corporation.getProduct(name, lastProduct).developmentProgress / 10), '■').padEnd(9, '_')}]`;
		ns.print(`║ ${paddedDivision} │ ${research} │ ${formattedProfit} │ ${productProgression} ║`);
	}
	//Footer
	const getLevel = ns.corporation.getUpgradeLevel;
	const unlocksOwned = CONSTANTS.unlockNames.reduce((total, current) => (corp.hasUnlockUpgrade(current)) ? total + 1 : total, 0);
	const totalProfit = corpo.revenue - corpo.expenses
	const formattedTotalProfit = formatMoney(totalProfit, (totalProfit < 1e33) ? 1 : 0).padStart(6, ' ');
	const funds = formatMoney(corp.getCorporation().funds, 0, true).padStart(4, ' ');
	const levels = {};
	for (const key of Object.keys(UPGRADES))
		levels[key] = Math.min(getLevel(UPGRADES[key]), 99).toString().padStart(2, ' ');
	ns.print('╟────┬────┬───┴┬────┬────┼────┬────┬──┴─┬──────┬────╢');
	ns.print(`║ SF │ ${levels.SF} │ WA │ ${levels.WA} │ PI │ ${levels.PI} │ NA │ ${levels.NA} │  SPI │ ${levels.SPI} ║`);
	ns.print('╟────┼────┼────┼────┼────┼────┼────┼────┼──────┼────╢');
	ns.print(`║ SS │ ${levels.SS} │ DS │ ${levels.DS} │ SB │ ${levels.SB} │ FW │ ${levels.FW} │ NNII │ ${levels.NNII} ║`);
	ns.print('╠════╧════╪════╧╤═══╧═══╤╧════╧════╧═╤══╧════╤═╧════╣');
	ns.print(`║ Unlocks │ ${unlocksOwned}/${CONSTANTS.unlockNames.length} │ Total │ ${formattedTotalProfit} \$/s │ Funds │ ${funds} ║`);
	ns.print('╚═════════╧═════╧═══════╧════════════╧═══════╧══════╝');
	//Resize
	//Possible width 9.735 * characters
	ns.resizeTail(516, 16 * (12 + corpo.divisions.length));
	compactTail(scriptName);
}

/*
	//Go public and set dividends
	CORP.goPublic(0);
	CORP.issueDividends(0.01);
	ns.print('SUCCESS Went public!');
*/