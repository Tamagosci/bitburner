//Thanks to /u/angrmgmt00 && Mughur
//https://docs.google.com/document/d/1fg333UNXWmZ2wZ0CnNWqwqiFQxu_LCImXUsr3fHKVeU
//Thanks to Jakob for first round improvements

import { getCities } from 'utils.js';

const INDUSTRIES = {
	agriculture: 'Agriculture',
	tobacco: 'Tobacco'
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

const COMPANY = 'Jormungandr';
const AGRI = 'Eden';
const TOBA = 'Sikar';
const CARE = 'Dhanvantari';
const SUM = 'SUM';
const MAX = 'MAX';
const MP = 'MP';
const HQ = 'Aevum';

const CORP_SCRIPT = 'corp.js';
const FUNDS_SLEEP = 30e3; //Used where it needs to periodically check something
const INVESTOR_SLEEP = 60e3;
const INVESTOR_THRESHOLDS = [450e9, 5e12, 1e15, 1e18];
const RESEARCH_THRESHOLDS = [100, 2e3, 10e3];
const HQ_RATIO = [3, 5, 2, 5, 6, 0, 0];
HQ_RATIO[SUM] = HQ_RATIO.reduce((a, b) => a + b);

/** @type {string[]} */
let CITIES;
let VALUATION_MULT = 1;
const MIN_VALUATION_MULT = 0.2;
let PRODUCT_COUNT = 0;

/** @type {Corporation} */
let corp;

/** @param {NS} ns */
export async function main(ns) {
	await build(ns);
}

/** @param {NS} ns */
async function build(ns) {
	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	ns.atExit(ns.closeTail);

	//Ease of use
	CITIES = getCities();
	corp = ns.corporation;
	VALUATION_MULT = ns.getBitNodeMultipliers().CorporationValuation;

	//If multiplier is 0 no reason in making a corp
	if (VALUATION_MULT === 0) {
		ns.print('ERROR BitNode multiplier for corporations is 0!');
		return;
	}

	//----------------------
	//    <<MAIN CODE>>
	//----------------------

	//Create corporation
	if (corp.hasCorporation()) {
		if (corp.getCorporation().divisions.includes(TOBA) && corp.getDivision(TOBA).products.length > 0) ns.spawn(CORP_SCRIPT);
		ns.print('WARN This script is only supposed to run when no corporation is owned!');
	}
	else if (startCorp(ns) === false) return;

	//Initial setup
	await setup(ns);

	//Deal with first investor round
	await roundI(ns);

	//Deal with second investor round	
	await roundII(ns);

	//Finishing touches (mostly Market-TA.II)
	await preMaintenance(ns);

	//Enter maintenance mode
	ns.spawn(CORP_SCRIPT);
}

/** @param {NS} ns */
function startCorp(ns) {
	//BN3 variant
	if (ns.getPlayer().bitNodeN === 3 && ns.corporation.createCorporation(COMPANY, false)) {
		ns.printf('SUCCESS Started %s on BN3.', COMPANY);
		return true;
	}
	//Other BitNodes
	else if (ns.corporation.createCorporation(COMPANY, true)) {
		ns.printf('SUCCESS Started corporation %s.', COMPANY);
		return true;
	}
	//Failed to start
	else {
		ns.print('ERROR Insufficient founds to start a corporation!');
		return false;
	}
}

/** @param {NS} ns */
async function setup(ns) {
	//--------------------------
	//    <<INITIAL SETUP>>
	//--------------------------
	ns.print('Starting setup process...');

	//Buy smart supply
	try {
		corp.unlockUpgrade('Smart Supply');
		ns.print('INFO Bought smart supply.');
	} catch {
		ns.print('WARN Smart supply already owned.');
	}

	//Expand to agriculture
	try {
		corp.expandIndustry(INDUSTRIES.agriculture, AGRI);
		ns.print('INFO Created agricultural division.');
	} catch {
		ns.print('WARN Agricultural division already exists.');
	}

	//Expand agriculture to all cities and get employees
	for (const city of CITIES) {
		if (corp.getDivision(AGRI).cities.includes(city) === false)
			corp.expandCity(AGRI, city);
		else ns.print(`WARN Already expanded ${AGRI} to ${city}.`);
		const office = corp.getOffice(AGRI, city);
		if (office.employees < office.size) {
			corp.hireEmployee(AGRI, city, POSITIONS.operations);
			corp.hireEmployee(AGRI, city, POSITIONS.engineer);
			corp.hireEmployee(AGRI, city, POSITIONS.business);
		}
	}
	ns.print('INFO Expanded agricultural divison to all cities.');

	//Buy AdVert
	await buyAdVertsToSpecificCount(ns, AGRI, 2);

	//Upgrade warehouses to 500
	await upgradeWarehousesToSpecificLevel(ns, AGRI, 5);
	ns.print('INFO Purchased and upgraded agricultural warehouses.');

	//Start selling materials
	for (const city of CITIES) {
		corp.sellMaterial(AGRI, city, MATERIALS.plants, MAX, MP);
		corp.sellMaterial(AGRI, city, MATERIALS.food, MAX, MP);
	}
	ns.print('INFO Started selling materials.');

	//--------------------------
	//    <<PRE-INVESTORS>>
	//--------------------------
	ns.print('Preparing for first investors round...');

	//Buy 3 Smart Storage
	while (corp.getUpgradeLevel(UPGRADES.SS) < 3)
		corp.levelUpgrade(UPGRADES.SS);
	ns.print('INFO Purchased 3x Smart Storage.');

	//Get employees to high morale, happiness and energy
	await satisfy(ns, AGRI);
	ns.print('INFO Improved employee satisfaction.');

	//Buy division multiplier materials
	for (const city of CITIES) {
		if (corp.getMaterial(AGRI, city, MATERIALS.estate).qty === 0) {
			corp.buyMaterial(AGRI, city, MATERIALS.hardware, 108);
			corp.buyMaterial(AGRI, city, MATERIALS.cores, 120);
			corp.buyMaterial(AGRI, city, MATERIALS.estate, 7430);
			ns.print(`Buying materials in ${city}...`);
			await ns.sleep((corp.getBonusTime() < 2e3) ? 10e3 : 2e3);
			corp.buyMaterial(AGRI, city, MATERIALS.hardware, 0);
			corp.buyMaterial(AGRI, city, MATERIALS.cores, 0);
			corp.buyMaterial(AGRI, city, MATERIALS.estate, 0);
		}
	}
	ns.print('INFO Bought hardware, ai cores and land for agricultural offices.');
}

/** @param {NS} ns */
async function roundI(ns) {
	//----------------------------------
	//    <<FIRST INVESTORS ROUND>>
	//----------------------------------
	ns.print('Starting 1st investors round...');

	//Get first investor rounds
	if (VALUATION_MULT < MIN_VALUATION_MULT) {
		ns.print('WARN Valuation multiplier is too low for the investment to be worth the share loss.')
	}
	else if (corp.getInvestmentOffer().round === 1) {
		await waitForAndAcceptInvestor(ns, INVESTOR_THRESHOLDS[0]);
		ns.print('SUCCESS Accepted 1st investment.');
	}
	else ns.print('WARN 1st investors round was already accepted.');

	//Get 9 employees per office 1x[Op, Eng, Bsn, Man], 5x RnD, 0x Trn
	await waitForFunds(ns, 60e9);
	for (const city of CITIES) {
		if (corp.getOffice(AGRI, city).size === 3) {
			corp.upgradeOfficeSize(AGRI, city, 6);
			corp.hireEmployee(AGRI, city, POSITIONS.management);
			for (let i = 0; i < 5; i++)
				corp.hireEmployee(AGRI, city, POSITIONS.rnd);
		}
	}
	ns.print('INFO Hired employees to 9 per office.');

	//Get to level 10 of 'Smart x' upgrades
	await waitForFunds(ns, 50e9);
	while (corp.getUpgradeLevel(UPGRADES.SF) < 10)
		corp.levelUpgrade(UPGRADES.SF);
	while (corp.getUpgradeLevel(UPGRADES.SS) < 10)
		corp.levelUpgrade(UPGRADES.SS);
	ns.print('INFO Upgraded Smart Factories and Smart Storage to lv10.');

	//Upgrade warehouses to lv10
	await upgradeWarehousesToSpecificLevel(ns, AGRI, 10);
	ns.print('INFO Upgraded warehouses to lv10.');

	//Improve employees situation
	await waitForFunds(ns, 1e9);
	await satisfy(ns, AGRI);
	ns.print('INFO Improved employee satisfaction.');

	//Buy division multiplier materials
	await waitForFunds(ns, 45e9);
	for (const city of CITIES) {
		if (corp.getMaterial(AGRI, city, MATERIALS.estate).qty === 74300) {
			corp.buyMaterial(AGRI, city, MATERIALS.robots, 9.6);
			corp.buyMaterial(AGRI, city, MATERIALS.hardware, 172);
			corp.buyMaterial(AGRI, city, MATERIALS.cores, 132);
			corp.buyMaterial(AGRI, city, MATERIALS.estate, 7210);
			ns.print(`Buying materials in ${city}...`);
			await ns.sleep((corp.getBonusTime() < 2e3) ? 10e3 : 2e3);
			corp.buyMaterial(AGRI, city, MATERIALS.robots, 0);
			corp.buyMaterial(AGRI, city, MATERIALS.hardware, 0);
			corp.buyMaterial(AGRI, city, MATERIALS.cores, 0);
			corp.buyMaterial(AGRI, city, MATERIALS.estate, 0);
		}
	}
	ns.print('INFO Bought hardware, ai cores and land for agricultural offices.');

	//OPTIONAL
	//Wait for some research points before continuing
	ns.print(`Waiting for ${RESEARCH_THRESHOLDS[0]} research...`);
	await waitForResearch(ns, AGRI, RESEARCH_THRESHOLDS[0]);

	//Reassign employees
	unassignAll(ns, AGRI);
	for (const city of CITIES) {
		corp.setAutoJobAssignment(AGRI, city, POSITIONS.operations, 3);
		corp.setAutoJobAssignment(AGRI, city, POSITIONS.engineer, 2);
		corp.setAutoJobAssignment(AGRI, city, POSITIONS.business, 2);
		corp.setAutoJobAssignment(AGRI, city, POSITIONS.management, 2);
	}
	ns.print('INFO Reassigned employees for increased production.');

	//OPTIONAL
	//Use extra found for more storage/mult.mats
	//Not bothered, strat will change with rework anyway
	//TODO: switch to jeeks packitin (^ but easier)
}

/** @param {NS} ns */
async function roundII(ns) {
	//----------------------------------
	//    <<SECOND INVESTORS ROUND>>
	//----------------------------------
	ns.print('Starting 2nd investors round...');

	//Get first investor rounds
	if (VALUATION_MULT < MIN_VALUATION_MULT) {
		ns.print('WARN Valuation multiplier is too low for the investment to be worth the share loss.')
	}
	else if (corp.getInvestmentOffer().round === 2) {
		await waitForAndAcceptInvestor(ns, INVESTOR_THRESHOLDS[1]);
		ns.print('SUCCESS Accepted 2nd investment.');
	}
	else ns.print('WARN 2nd investors round was already accepted.');

	//Upgrade warehouses
	await upgradeWarehousesToSpecificLevel(ns, AGRI, 20);
	ns.print('INFO Upgraded agricultural warehouses.');

	//Purchase multiplier materials
	await waitForFunds(ns, 10e9);
	for (const city of CITIES) {
		if (corp.getMaterial(AGRI, city, MATERIALS.estate).qty === 146400) {
			corp.buyMaterial(AGRI, city, MATERIALS.robots, 63);
			corp.buyMaterial(AGRI, city, MATERIALS.hardware, 650);
			corp.buyMaterial(AGRI, city, MATERIALS.cores, 375);
			corp.buyMaterial(AGRI, city, MATERIALS.estate, 840);
			ns.print(`Buying materials in ${city}...`);
			await ns.sleep((corp.getBonusTime() < 2e3) ? 10e3 : 2e3);
			corp.buyMaterial(AGRI, city, MATERIALS.robots, 0);
			corp.buyMaterial(AGRI, city, MATERIALS.hardware, 0);
			corp.buyMaterial(AGRI, city, MATERIALS.cores, 0);
			corp.buyMaterial(AGRI, city, MATERIALS.estate, 0);
		}
	}
	ns.print('INFO Bought hardware, ai cores and land for agricultural offices.');

	//Get some R&D going before leaving
	await waitForFunds(ns, 35e9);
	for (const city of CITIES) {
		const office = ns.corporation.getOffice(AGRI, city);
		if (office.size < 12) {
			ns.corporation.upgradeOfficeSize(AGRI, city, 12 - office.size);
			for (let i = 0; i < 3; i++)
				ns.corporation.hireEmployee(AGRI, city, POSITIONS.rnd);
		}
	}
	ns.print('INFO Hired r&d employees for agricultural offices.');

	//--------------------
	//    <<TOBACCO>>
	//--------------------
	ns.print('Moving on to tobacco products!');

	//Create tobacco division
	await waitForFunds(ns, 20e9);
	try {
		corp.expandIndustry(INDUSTRIES.tobacco, TOBA);
		ns.printf('SUCCESS Created %s division for tobacco!', TOBA);
	} catch {
		ns.print('WARN Tobacco division already exists.');
	}

	//Expand to all cities
	await waitForFunds(ns, 30e9);
	for (const city of CITIES) {
		if (corp.getDivision(TOBA).cities.includes(city) === false) {
			corp.expandCity(TOBA, city);
			corp.purchaseWarehouse(TOBA, city);
		}
		else ns.print(`WARN Already expanded ${TOBA} to ${city}.`);
	}
	ns.print('INFO Expanded tobacco to all cities.');

	//Hire for HQ
	//Ratio = [x, x, x/2, x, 0, 0]
	await waitForFunds(ns, 300e9);
	const officeHQ = corp.getOffice(TOBA, HQ);
	if (officeHQ.size < HQ_RATIO[SUM] * 3) {
		corp.upgradeOfficeSize(TOBA, HQ, HQ_RATIO[SUM] * 3 - 3); //Total of ~60
		officeHQ.size = HQ_RATIO[SUM] * 3;
	}
	if (officeHQ.employees < officeHQ.size) {
		const employeePositions = corp.getConstants().employeePositions;
		for (let i = 0; i < employeePositions.length; i++)
			for (let o = 0; o < HQ_RATIO[i] * 3; o++)
				corp.hireEmployee(TOBA, HQ, employeePositions[i]);
		ns.print('INFO Hired HQ employees.');
	}
	else ns.print('WARN HQ Already at ideal employee count.');

	//Hire for subs
	//Ratio = [1, 1, 1, 1, x, 0]
	await waitForFunds(ns, 200e9);
	for (const city of CITIES) {
		if (city === HQ) continue;
		const office = corp.getOffice(TOBA, city);
		if (office.size < 30) {
			corp.upgradeOfficeSize(TOBA, city, 27); //Total of ~30
			office.size += 27;
		}
		if (office.employees < office.size) {
			corp.hireEmployee(TOBA, city, POSITIONS.operations);
			corp.hireEmployee(TOBA, city, POSITIONS.engineer);
			corp.hireEmployee(TOBA, city, POSITIONS.business);
			corp.hireEmployee(TOBA, city, POSITIONS.management);
			for (let i = 0; i < 26; i++)
				corp.hireEmployee(TOBA, city, POSITIONS.rnd);
		}
	}
	ns.print('INFO Hired production cities employees');

	//Upgrade stuff
	let maxed = false;
	ns.print('Buying various upgrades, might take a while...');
	while (maxed === false) {
		//let [SF, WA, NA, PI, SS, NNII, FW, DS, SPI, SB];
		let NA = corp.getUpgradeLevel(UPGRADES.NA);
		let PI = corp.getUpgradeLevel(UPGRADES.PI);
		let NNII = corp.getUpgradeLevel(UPGRADES.NNII);
		let FW = corp.getUpgradeLevel(UPGRADES.FW);
		let DS = corp.getUpgradeLevel(UPGRADES.DS);
		let SPI = corp.getUpgradeLevel(UPGRADES.SPI);
		//DreamSense
		while (DS < 10 && corp.getUpgradeLevelCost(UPGRADES.DS) < corp.getCorporation().funds) {
			corp.levelUpgrade(UPGRADES.DS);
			if (++DS === 10) ns.print(`INFO Maxed ${UPGRADES.DS} at level 10`);
		}
		//Neural Accelerators
		while (NA < 20 && corp.getUpgradeLevelCost(UPGRADES.NA) < corp.getCorporation().funds) {
			corp.levelUpgrade(UPGRADES.NA);
			if (++NA === 20) ns.print(`INFO Maxed ${UPGRADES.NA} at level 20`);
		}
		//Nuoptimal Nootropic Injector Implants
		while (NNII < 20 && corp.getUpgradeLevelCost(UPGRADES.NNII) < corp.getCorporation().funds) {
			corp.levelUpgrade(UPGRADES.NNII);
			if (++NNII === 20) ns.print(`INFO Maxed ${UPGRADES.NNII} at level 20`);
		}
		//FocusWires
		while (FW < 20 && corp.getUpgradeLevelCost(UPGRADES.FW) < corp.getCorporation().funds) {
			corp.levelUpgrade(UPGRADES.FW);
			if (++FW === 20) ns.print(`INFO Maxed ${UPGRADES.FW} at level 20`);
		}
		//Speech Processor Implants
		while (SPI < 20 && corp.getUpgradeLevelCost(UPGRADES.SPI) < corp.getCorporation().funds) {
			corp.levelUpgrade(UPGRADES.SPI);
			if (++SPI === 20) ns.print(`INFO Maxed ${UPGRADES.SPI} at level 20`);
		}
		//Nuoptimal Nootropic Injector Implants
		while (NNII < 20 && corp.getUpgradeLevelCost(UPGRADES.NNII) < corp.getCorporation().funds) {
			corp.levelUpgrade(UPGRADES.NNII);
			if (++NNII === 20) ns.print(`INFO Maxed ${UPGRADES.NNII} at level 20`);
		}
		//Project Insight
		while (PI < 10 && corp.getUpgradeLevelCost(UPGRADES.PI) < corp.getCorporation().funds) {
			corp.levelUpgrade(UPGRADES.PI);
			if (++PI === 10) ns.print(`INFO Maxed ${UPGRADES.PI} at level 10`);
		}
		maxed = (DS === 10) && (FW === 20) && (NA === 20)
			&& (SPI === 20) && (NNII === 20) && (PI === 10);
		if (maxed === false) await ns.sleep(FUNDS_SLEEP);
	}
	ns.print('INFO Levelled up some stuff.');

	//Make first product
	if (corp.getDivision(TOBA).products.length === 0)
		await createProduct(ns, TOBA);
}

/** @param {NS} ns */
async function preMaintenance(ns) {
	//--------------------------------------
	//    <<LAST UPGRADES BEFORE AUTO>>
	//--------------------------------------
	ns.print('Last jobs before going into automatic operation.');

	await satisfy(ns, TOBA);

	//Wilson Analytics to lv10
	await waitForFunds(ns, 750e9);
	while (ns.corporation.getUpgradeLevel(UPGRADES.WA) < 10)
		ns.corporation.levelUpgrade(UPGRADES.WA);

	//Hire a shit ton of employees in HQ
	const corpConstants = ns.corporation.getConstants();
	while (corp.getCorporation().funds >= corp.getOfficeSizeUpgradeCost(TOBA, HQ, HQ_RATIO[SUM])) {
		corp.upgradeOfficeSize(TOBA, HQ, HQ_RATIO[SUM]);
		for (let i = 0; i < corpConstants.employeePositions.length; i++)
			for (let o = 0; o < HQ_RATIO[i]; o++)
				corp.hireEmployee(TOBA, HQ, corpConstants.employeePositions[i]);
	}
}

/** @param {NS} ns */
export async function createProduct(ns, division) {
	//Syntax
	corp = ns.corporation;
	//Calculate funding
	const div = corp.getDivision(division);
	const profit = div.lastCycleRevenue - div.lastCycleExpenses;
	//Pick highest between 2b, 1 minute of income or 2.5% funds
	const funds = Math.max(1e9, profit * 6, corp.getCorporation().funds * 0.025);
	//Wait for funds, 2x because design + marketing
	await waitForFunds(ns, 2 * funds);
	//Pick a name
	const product = division + '-' + (PRODUCT_COUNT++).toString();
	corp.makeProduct(division, HQ, product, funds, funds);
	ns.printf('Started developing product %s.', product);
}

/** @param {NS} ns */
async function satisfy(ns, division, threshold = 95) {
	const tickSleep = 10e3;
	for (const city of CITIES) {
		ns.print(`Increasing employee energy for division ${division} in  ${city}.`)
		while (corp.getOffice(division, city).avgEne < threshold) {
			corp.buyCoffee(division, city);
			await ns.sleep(tickSleep);
		}
		ns.print(`Increasing employee morale for division ${division} in  ${city}.`)
		while (Math.min(corp.getOffice(division, city).avgHap, corp.getOffice(division, city).avgMor) < threshold) {
			corp.throwParty(division, city, 500e3);
			await ns.sleep(tickSleep);
		}
	}
}

/** @param {NS} ns */
async function waitForAndAcceptInvestor(ns, threshold) {
	const targetRound = ns.corporation.getInvestmentOffer().round;
	ns.print('Waiting for investors offer...');
	while (ns.corporation.getInvestmentOffer().funds < threshold * VALUATION_MULT && ns.corporation.getInvestmentOffer().round === targetRound)
		await ns.sleep(INVESTOR_SLEEP);
	if (ns.corporation.getInvestmentOffer().round === targetRound)
		ns.corporation.acceptInvestmentOffer();
}

/** @param {NS} ns */
async function waitForFunds(ns, amount) {
	if (ns.corporation.getCorporation().funds < amount) { ns.print('Waiting for funds...'); }
	while (ns.corporation.getCorporation().funds < amount) { await ns.sleep(FUNDS_SLEEP); }
}

/** @param {NS} ns */
async function waitForResearch(ns, division, target) {
	while (ns.corporation.getDivision(division).research < target)
		await ns.sleep(FUNDS_SLEEP);
}

/** @param {NS} ns */
function unassignAll(ns, division) {
	for (const city of CITIES)
		unassignCity(ns, division, city);
}

/** @param {NS} ns */
function unassignCity(ns, division, city) {
	for (const position of corp.getConstants().employeePositions)
		corp.setAutoJobAssignment(division, city, position, 0);
}

/** 
 * @param {NS} ns 
 * @param {string} division
 * @param {number} targetLevel
 */
async function upgradeWarehousesToSpecificLevel(ns, division, targetLevel) {
	for (const city of CITIES) {
		if (corp.hasWarehouse(division, city) === false)
			corp.purchaseWarehouse(division, city);
		const warehouse = corp.getWarehouse(division, city);
		if (warehouse.level < targetLevel) {
			ns.print(`Upgrading ${division}'s warehouse in ${city}.`);
			const levesToPurchase = targetLevel - warehouse.level;
			await waitForFunds(ns, corp.getUpgradeWarehouseCost(division, city, levesToPurchase));
			corp.upgradeWarehouse(division, city, levesToPurchase);
		}
		else ns.print(`${division}'s warehouse in ${city} was already >= the requested level.`);
	}
}

/** 
 * @param {NS} ns 
 * @param {string} division
 * @param {number} targetCount
 */
async function buyAdVertsToSpecificCount(ns, division, targetCount) {
	if (ns.corporation.getHireAdVertCount(division) >= targetCount) {
		ns.print(`${division} already bought ${targetCount} AdVerts.`);
		return;
	}
	while (ns.corporation.getHireAdVertCount(division) < targetCount) {
		ns.print(`Buying ${division}'s AdVert number ${ns.corporation.getHireAdVertCount(division) + 1}.`);
		await waitForFunds(ns, ns.corporation.getHireAdVertCost(division));
		ns.corporation.hireAdVert(division);
	}
}