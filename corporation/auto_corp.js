//Thanks to BitBurner Discord for the theory
//Thanks to CatLover and their manual for exact values
//https://drive.google.com/file/d/1PCKaKgMBXrYsPyZ-vTRR9MBQI-f6ersJ/view
//Code is all written by me, no copy paste

import { getCities, formatNumberCustom, compactTail } from 'utils.js';
import { fakeSmartSupply } from 'corporation/smart_supply.js'

const INDUSTRIES = {
	agriculture: 'Agriculture',
	chemical: 'Chemical',
	tobacco: 'Tobacco'
};

const JOBS = {
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
	food: 'Food',
	plants: 'Plants',
	hardware: 'Hardware',
	chemicals: 'Chemicals',
	robots: 'Robots',
	cores: 'AI Cores',
	estate: 'Real Estate'
};

const MATERIALS_SIZE = {
	water: 0.05,
	food: 0.03,
	plants: 0.05,
	hardware: 0.06,
	chemicals: 0.05,
	robots: 0.5,
	cores: 0.1,
	estate: 0.005
}

const UPGRADES = {
	SF: 'Smart Factories',
	WA: 'Wilson Analytics',
	NA: 'Neural Accelerators',
	PI: 'Project Insight',
	SS: 'Smart Storage',
	NNII: 'Nuoptimal Nootropic Injector Implants',
	FW: 'FocusWires',
	DS: 'DreamSense', //Guide explains why it is detrimental
	SPI: 'Speech Processor Implants',
	SB: 'ABC SalesBots'
};

const UNLOCKS = {
	SMART_SUPPLY: 'Smart Supply',
	EXPORT: 'Export',
	SHADY_ACCOUNTING: 'Shady Accounting',
	GOV_PARTNERSHIP: 'Government Partnership'
};

const RESEARCH = {
	lab: 'Hi-Tech R&D Laboratory',
	autobrew: 'AutoBrew',
	autoparty: 'AutoPartyManager',
	autodrug: 'Automatic Drug Administration',
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

/** 
 * States happen in order
 * START > PURCHASE > PRODUCTION > EXPORT > SALE
 */
const STATES = {
	START: 'START',
	PURCHASE: 'PURCHASE',
	PRODUCTION: 'PRODUCTION',
	EXPORT: 'EXPORT',
	SALE: 'SALE'
};

const COMPANY = 'Jormungandr';
const AGRI = 'Eden';
const CHEM = 'Trismegistus';
const TOBA = 'Sikar';
//const CARE = 'Dhanvantari';
const EXPORT_STRING = '(IPROD+IINV/10)*(-1)';
const HASH_RESEARCH = 'Exchange for Corporation Research';
const HASH_FUNDS = 'Sell for Corporation Funds';
const SUM = 'SUM';
const MAX = 'MAX';
const MP = 'MP';
const HQ = 'Sector-12'; //TODO: switch to sector or volhaven

//const CORP_SCRIPT = 'corporation/auto_corp.js';
const ENERGY_THRESHOLD = 99;
const MORALE_THRESHOLD = 99;
const ROUND_I_INVESTOR_THRESHOLD = 540e9;
const ROUND_II_INVESTOR_THRESHOLD = 14e12;
const ROUND_III_INVESTOR_THRESHOLD = 10e15;
const ROUND_IV_INVESTOR_THRESHOLD = 100e18;
const ADVERT_PROFIT_THRESHOLD = 1e18;
const EMPLOYEE_RATIO_PROFIT_THRESHOLD = 1e30;
const MIN_VALUATION_MULT = 0.4;

/** @type {string[]} */
let CITIES;
let VALUATION_MULT = 1;
let PRODUCT_COUNT = 0;
let LAST_PRODUCT_NAME = undefined;
let MANUAL_ROUND = 1;
let SETUP_DONE = false;

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
	//ns.atExit(ns.closeTail);
	await ns.sleep(0);
	//ns.moveTail(1957, 696);
	ns.moveTail(565, 28);

	//If multiplier is 0 no reason in making a corp
	VALUATION_MULT = ns.getBitNodeMultipliers().CorporationValuation;
	if (VALUATION_MULT === 0) {
		ns.print('ERROR BitNode multiplier for corporations is 0!');
		return;
	}

	//Create corporation
	if (startCorp(ns) === false) return;

	//Ease of use
	let cyclesSinceStart = 0;
	CITIES = getCities();
	corp = ns.corporation;
	loadProductCount(ns, TOBA);
	if (VALUATION_MULT < MIN_VALUATION_MULT) {
		const corporationData = ns.corporation.getCorporation();
		SETUP_DONE = corporationData.public;
		if (SETUP_DONE) MANUAL_ROUND = 5;
		else if (corporationData.divisions.includes(TOBA)) MANUAL_ROUND = 3;
		else if (corporationData.divisions.includes(CHEM)) MANUAL_ROUND = 2;
		else MANUAL_ROUND = 1;
	}
	else {
		const startupOffer = ns.corporation.getInvestmentOffer();
		SETUP_DONE = (startupOffer.round ?? 5 > 3)
	}

	//-----------------------------------------------------------------------
	//								<< MAIN CODE >>
	//-----------------------------------------------------------------------

	while (true) {
		await waitForState(ns, STATES.START);

		//TODO: Improve logging all throughout the rounds 1-4
		ns.print(`\nINFO Cycle n.${++cyclesSinceStart}`);

		const corporationData = ns.corporation.getCorporation();

		//Throw tea and drink parties
		for (const division of corporationData.divisions)
			drinkTeaAndThrowParty(ns, division);

		//Used to bypass investors in bad nodes
		if (VALUATION_MULT >= MIN_VALUATION_MULT) {
			if (corporationData.public)
				MANUAL_ROUND = 5;
			else
				MANUAL_ROUND = ns.corporation.getInvestmentOffer().round;
		}
			
		
		switch (MANUAL_ROUND) {
			case 1:
				await optimizedRoundI(ns);
				break;
			case 2:
				await optimizedRoundII(ns);
				break;
			case 3:
				if (!SETUP_DONE) await optimizedRoundIII(ns);
				if (!SETUP_DONE) break;
				//Skip investor if bad node for corps
				if (VALUATION_MULT < MIN_VALUATION_MULT) {
					MANUAL_ROUND = 4;
					break;
				}
				//Investors
				const offer3 = ns.corporation.getInvestmentOffer();
				if (offer3.funds >= ROUND_III_INVESTOR_THRESHOLD * VALUATION_MULT && offer3.round === 3)
					ns.corporation.acceptInvestmentOffer();
				else
					ns.print(`Current offer is ${ns.formatNumber(offer3.funds, 1)} / ${ns.formatNumber(ROUND_III_INVESTOR_THRESHOLD * VALUATION_MULT, 1)}.`);
				break;
			case 4:
				//Skip investor if bad node for corps
				if (VALUATION_MULT < MIN_VALUATION_MULT) {
					ns.corporation.goPublic(0);
					ns.corporation.issueDividends(0.01);
					MANUAL_ROUND = 5;
					break;
				}
				//Investors
				const offer4 = ns.corporation.getInvestmentOffer();
				if (offer4.funds >= ROUND_IV_INVESTOR_THRESHOLD * VALUATION_MULT && offer4.round === 4) {
					ns.corporation.acceptInvestmentOffer();
					ns.corporation.goPublic(0);
					ns.corporation.issueDividends(0.01);
				}
				else
					ns.print(`Current offer is ${ns.formatNumber(offer4.funds, 1)} / ${ns.formatNumber(ROUND_IV_INVESTOR_THRESHOLD * VALUATION_MULT, 1)}.`);
			default:
				//I think this being empty is correct
				break;
		}

		if (SETUP_DONE) {
			optimizedAutocorp(ns);
			report(ns);
		}

		await waitForState(ns, STATES.PRODUCTION);
		if (SETUP_DONE) await autocorpProduct(ns);

		await waitForState(ns, STATES.SALE);
		//Custom smart supply to cut on costs rounds 1/2
		if (!SETUP_DONE) fakeSmartSupply(ns);
	}
}

/** @param {NS} ns */
function startCorp(ns) {
	//Already has corporation
	if (ns.corporation.hasCorporation()) {
		ns.print('INFO Corporation already exists.');
		return true;
	}
	//BN3 variant
	else if (ns.getResetInfo().currentNode === 3 && ns.corporation.createCorporation(COMPANY, false)) {
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
async function optimizedRoundI(ns) {
	//Create agriculture division
	if (corp.getCorporation().divisions.includes(AGRI)) {
		ns.print('WARN Agricultural division already exists.');
	}
	else {
		corp.expandIndustry(INDUSTRIES.agriculture, AGRI);
		ns.print('INFO Created agricultural division.');
	}

	//Expand agriculture to all cities and get 4 employees each
	const agricultureData = ns.corporation.getDivision(AGRI);
	for (const city of CITIES) {
		//Expansion
		if (!agricultureData.cities.includes(city)) {
			corp.expandCity(AGRI, city);
			ns.print(`INFO Expanded agricultural divison to ${city}.`);
		}
		//Office
		const office = corp.getOffice(AGRI, city);
		if (office.size < 4) {
			corp.upgradeOfficeSize(AGRI, city, 1);
			office.size = 4;
			ns.print(`INFO Increased agriculture office size in ${city} to 4.`);
		}
		while (office.numEmployees < office.size)
			if (corp.hireEmployee(AGRI, city, JOBS.rnd))
				office.numEmployees++
	}

	//Warehouse to level 6
	if (!upgradeWarehousesToSpecificLevel(ns, AGRI, 6)) return;

	//Smart Storage to level 6
	if (!buyUpgradeToSpecificCount(ns, UPGRADES.SS, 6)) return;

	//AdVert to level 2
	if (!buyAdVertsToSpecificCount(ns, AGRI, 2)) return;

	//Enable materials sale
	for (const city of CITIES) {
		corp.sellMaterial(AGRI, city, MATERIALS.plants, MAX, MP);
		corp.sellMaterial(AGRI, city, MATERIALS.food, MAX, MP);
	}
	ns.print('INFO Set agriculture materials sale data.');

	//Improve employee conditions
	for (const city of CITIES) {
		const office = corp.getOffice(AGRI, city);
		if (office.avgEnergy < ENERGY_THRESHOLD || office.avgMorale < MORALE_THRESHOLD) {
			ns.print(`Waiting for employee energy/morale in ${city} to reach threshold.`);
			return;
		}
	}

	//Wait until research >= 55
	if (corp.getDivision(AGRI).researchPoints < 55) {
		if (buyResearchWithHashes(ns)) {
			ns.print('INFO Spent hashes to skip waiting for research.');
		}
		else {
			ns.print('Waiting for agriculture to reach 55 research points.');
			return; //This is so smart supply and throw tea can work
		}
	}
	
	//Reassign employees to 1 each of prod
	for (const city of CITIES) {
		corp.setAutoJobAssignment(AGRI, city, JOBS.rnd, 0);
		corp.setAutoJobAssignment(AGRI, city, JOBS.operations, 1);
		corp.setAutoJobAssignment(AGRI, city, JOBS.engineer, 1);
		corp.setAutoJobAssignment(AGRI, city, JOBS.business, 1);
		corp.setAutoJobAssignment(AGRI, city, JOBS.management, 1);
	}
	ns.print('INFO Reassigned agriculture employees to production positions.');

	//Purchase boost materials (NO bulk)
	for (const city of CITIES) {
		if (corp.getMaterial(AGRI, city, MATERIALS.estate).stored >= 106686) continue;
		let storedQuantity = 0;
		//Agriculture
		storedQuantity = corp.getMaterial(AGRI, city, MATERIALS.cores).stored;
		corp.buyMaterial(AGRI, city, MATERIALS.cores, (1733 - storedQuantity) / 10);
		storedQuantity = corp.getMaterial(AGRI, city, MATERIALS.hardware).stored;
		corp.buyMaterial(AGRI, city, MATERIALS.hardware, (1981 - storedQuantity) / 10);
		storedQuantity = corp.getMaterial(AGRI, city, MATERIALS.estate).stored;
		corp.buyMaterial(AGRI, city, MATERIALS.estate, (106686 - storedQuantity) / 10);
		ns.print(`Buying materials in ${city}...`);
		await waitForState(ns, STATES.PURCHASE);
		//Stop buying
		corp.buyMaterial(AGRI, city, MATERIALS.cores, 0);
		corp.buyMaterial(AGRI, city, MATERIALS.hardware, 0);
		corp.buyMaterial(AGRI, city, MATERIALS.estate, 0);
	}

	//Skip investor if bad node for corps
	if (VALUATION_MULT < MIN_VALUATION_MULT) {
		MANUAL_ROUND = 2;
		return;
	}

	//Investors (650b)
	ns.print(`Waiting for investor\'s offer to reach ${ns.formatNumber(ROUND_I_INVESTOR_THRESHOLD * VALUATION_MULT, 1)}.`);
	const offer = corp.getInvestmentOffer();
	if (offer.funds >= ROUND_I_INVESTOR_THRESHOLD * VALUATION_MULT && offer.round === 1) {
		ns.print(`INFO Accepted first offer of ${ns.formatNumber(offer.funds, 1)}.`);
		corp.acceptInvestmentOffer();
	}
	else ns.print(`Current offer is ${ns.formatNumber(offer.funds, 1)}.`);
}

/** @param {NS} ns */
async function optimizedRoundII(ns) {
	let funds = corp.getCorporation().funds;

	//Unlock export
	if (!corp.hasUnlock(UNLOCKS.EXPORT)) {
		if (funds < corp.getUnlockCost(UNLOCKS.EXPORT)) {
			ns.print('Waiting for funds to unlock exports.');
			return;
		}
		funds -= corp.getUnlockCost(UNLOCKS.EXPORT);
		corp.purchaseUnlock(UNLOCKS.EXPORT);
		ns.print('INFO Unlocked ability to export materials.');
	}

	//Upgrade agri offices to 8
	for (const city of CITIES) {
		const office = corp.getOffice(AGRI, city);
		if (office.size < 8) {
			const upgradeCost = corp.getOfficeSizeUpgradeCost(AGRI, city, 8 - office.size)
			if (funds < upgradeCost) return;
			corp.upgradeOfficeSize(AGRI, city, 8 - office.size);
			office.size = 8;
			funds -= upgradeCost;
			ns.print('INFO Increased agriculture\'s office sizes to 8.');
		}
		while (office.numEmployees < office.size)
			if (corp.hireEmployee(AGRI, city))
				office.numEmployees++;
		unassignCity(ns, AGRI, city);
		corp.setAutoJobAssignment(AGRI, city, JOBS.operations, 3);
		corp.setAutoJobAssignment(AGRI, city, JOBS.engineer, 1);
		corp.setAutoJobAssignment(AGRI, city, JOBS.business, 2);
		corp.setAutoJobAssignment(AGRI, city, JOBS.management, 2);
	}

	//AdVert to 8
	if (!buyAdVertsToSpecificCount(ns, AGRI, 8)) return;

	//Warehouse to 16
	if (!upgradeWarehousesToSpecificLevel(ns, AGRI, 16)) return;

	//Create chemical division
	let corporationData = ns.corporation.getCorporation();
	if (corporationData.divisions.includes(CHEM)) {
		ns.print('WARN Chemical division already exists.');
	}
	else if (corporationData.funds < 70e9) {
		ns.print(`Waiting for funds to create chemical division. (${ns.formatNumber(corporationData.fund, 1)}.70b)`);
		return; 
	}
	else {
		ns.corporation.expandIndustry(INDUSTRIES.chemical, CHEM);
		ns.print('INFO Created chemical division.');
	}

	//Expand and Hire employess
	corporationData = ns.corporation.getCorporation();
	const division = ns.corporation.getDivision(CHEM);
	for (const city of CITIES) {
		if (!division.cities.includes(city)) {
			if (corporationData.funds < 4e9) {
				ns.print(`Waiting for funds to expand chemical division to ${city}.`);
				return;
			}
			ns.corporation.expandCity(CHEM, city);
			ns.print(`Expanded chemical to ${city}.`);
			corporationData.funds -= 4e9;
		}
		const office = ns.corporation.getOffice(CHEM, city);
		while (office.numEmployees < office.size)
			if (ns.corporation.hireEmployee(CHEM, city, JOBS.rnd))
				office.numEmployees++;
	}

	//Warehouses to 2
	if (!upgradeWarehousesToSpecificLevel(ns, CHEM, 2)) return;

	//Enable materials sale
	for (const city of CITIES)
		corp.sellMaterial(CHEM, city, MATERIALS.chemicals, MAX, MP);
	ns.print('INFO Set chemical materials sale data.');

	//Export
	for (const city of CITIES) {
		//Chemicals
		corp.cancelExportMaterial(CHEM, city, AGRI, city, MATERIALS.chemicals);
		corp.exportMaterial(CHEM, city, AGRI, city, MATERIALS.chemicals, EXPORT_STRING);
		//Plants
		corp.cancelExportMaterial(AGRI, city, CHEM, city, MATERIALS.plants);
		corp.exportMaterial(AGRI, city, CHEM, city, MATERIALS.plants, EXPORT_STRING);
	}
	ns.print('INFO Configured export routes between agriculture and chemical.');

	//Smart Storage to 25
	if (!buyUpgradeToSpecificCount(ns, UPGRADES.SS, 25)) return;

	//Smart Factory to 20
	if (!buyUpgradeToSpecificCount(ns, UPGRADES.SF, 20)) return;

	//Wait until research (AGRI) >= 700 and research (CHEM) >= 390
	if (corp.getDivision(AGRI).researchPoints < 700 || corp.getDivision(CHEM).researchPoints < 390) {
		if (buyResearchWithHashes(ns)) {
			ns.print('INFO Spent hashes to skip waiting for research.');
		}
		else {
			ns.print('Waiting for agriculture and chemical to reach 700 and 390 research points respectively.');
			return; //This is so smart supply and throw tea can work
		}
	}

	//Switch jobs from R&D to production
	for (const city of CITIES) {
		//Agriculture
		unassignCity(ns, AGRI, city);
		corp.setAutoJobAssignment(AGRI, city, JOBS.operations, 3);
		corp.setAutoJobAssignment(AGRI, city, JOBS.engineer, 1);
		corp.setAutoJobAssignment(AGRI, city, JOBS.business, 2);
		corp.setAutoJobAssignment(AGRI, city, JOBS.management, 2);
		//Chemical
		unassignCity(ns, CHEM, city);
		corp.setAutoJobAssignment(CHEM, city, JOBS.operations, 1);
		corp.setAutoJobAssignment(CHEM, city, JOBS.engineer, 1);
		corp.setAutoJobAssignment(CHEM, city, JOBS.business, 1);
	}
	ns.print('INFO Reassigned all employees to production positions.')

	//Purchase boost materials (NO bulk)
	for (const city of CITIES) {
		if (corp.getMaterial(CHEM, city, MATERIALS.robots).stored >= 54) continue;
		let storedQuantity = 0;
		//Agriculture
		storedQuantity = corp.getMaterial(AGRI, city, MATERIALS.cores).stored;
		corp.buyMaterial(AGRI, city, MATERIALS.cores, (8556 - storedQuantity) / 10);
		storedQuantity = corp.getMaterial(AGRI, city, MATERIALS.hardware).stored;
		corp.buyMaterial(AGRI, city, MATERIALS.hardware, (9563 - storedQuantity) / 10);
		storedQuantity = corp.getMaterial(AGRI, city, MATERIALS.estate).stored;
		corp.buyMaterial(AGRI, city, MATERIALS.estate, (434200 - storedQuantity) / 10);
		storedQuantity = corp.getMaterial(AGRI, city, MATERIALS.robots).stored;
		corp.buyMaterial(AGRI, city, MATERIALS.robots, (1311 - storedQuantity) / 10);
		//Chemical
		storedQuantity = corp.getMaterial(CHEM, city, MATERIALS.cores).stored;
		corp.buyMaterial(CHEM, city, MATERIALS.cores, (1717 - storedQuantity) / 10);
		storedQuantity = corp.getMaterial(CHEM, city, MATERIALS.hardware).stored;
		corp.buyMaterial(CHEM, city, MATERIALS.hardware, (3194 - storedQuantity) / 10);
		storedQuantity = corp.getMaterial(CHEM, city, MATERIALS.estate).stored;
		corp.buyMaterial(CHEM, city, MATERIALS.estate, (54917 - storedQuantity) / 10);
		storedQuantity = corp.getMaterial(CHEM, city, MATERIALS.robots).stored;
		corp.buyMaterial(CHEM, city, MATERIALS.robots, (54 - storedQuantity) / 10);
		ns.print(`Buying materials in ${city}...`);
		await waitForState(ns, STATES.PURCHASE);
		//Stop buying
		corp.buyMaterial(AGRI, city, MATERIALS.cores, 0);
		corp.buyMaterial(AGRI, city, MATERIALS.hardware, 0);
		corp.buyMaterial(AGRI, city, MATERIALS.estate, 0);
		corp.buyMaterial(AGRI, city, MATERIALS.robots, 0);
		corp.buyMaterial(CHEM, city, MATERIALS.cores, 0);
		corp.buyMaterial(CHEM, city, MATERIALS.hardware, 0);
		corp.buyMaterial(CHEM, city, MATERIALS.estate, 0);
		corp.buyMaterial(CHEM, city, MATERIALS.robots, 0);
	}
	
	//Skip investor if bad node for corps
	if (VALUATION_MULT < MIN_VALUATION_MULT) {
		MANUAL_ROUND = 3;
		return;
	}

	//Investors (14t)
	ns.print(`Waiting for investor\'s offer to reach ${ns.formatNumber(ROUND_II_INVESTOR_THRESHOLD * VALUATION_MULT, 1)}.`);
	const offer = corp.getInvestmentOffer();
	if (offer.funds >= ROUND_II_INVESTOR_THRESHOLD * VALUATION_MULT && offer.round === 2) {
		ns.print(`INFO Accepted second offer of ${ns.formatNumber(offer.funds, 1)}.`);
		corp.acceptInvestmentOffer();
	}
	else ns.print(`Current offer is ${ns.formatNumber(offer.funds, 1)}.`);
}
/** @param {NS} ns */
async function optimizedRoundIII(ns) {
	const constantsData = ns.corporation.getConstants();
	//Get smart supply
	if (!corp.hasUnlock(UNLOCKS.SMART_SUPPLY)) {
		if (corp.getCorporation().funds < corp.getUnlockCost(UNLOCKS.SMART_SUPPLY)) return;
		corp.purchaseUnlock(UNLOCKS.SMART_SUPPLY);
		for (const division of ns.corporation.getCorporation().divisions) {
			for (const city of ns.corporation.getDivision(division).cities) {
				ns.corporation.setSmartSupply(division, city, true);
				for (const material of constantsData.materialNames)
					ns.corporation.setSmartSupplyOption(division, city, material, 'leftovers');
			}
		}
		ns.print('INFO Unlocked Smart Supply.');
	}
	else ns.print('WARN Smart Supply has already been unlocked.');

	//Create tobacco division
	if (corp.getCorporation().divisions.includes(TOBA)) {
		ns.print('WARN Tobacco division already exists.');
	}
	else if (corp.getCorporation().funds < 20e9) {
		ns.print(`Waiting for funds to reach 20b.`);
		return; 
	}
	else {
		corp.expandIndustry(INDUSTRIES.tobacco, TOBA);
		ns.print('INFO Created tobacco division.');
	}

	//Expand and Hire employess
	const division = corp.getDivision(TOBA);
	for (const city of CITIES) {
		if (!division.cities.includes(city)) {
			corp.expandCity(TOBA, city);
			ns.print(`Expanded tobacco to ${city}.`);
		}
		const office = corp.getOffice(TOBA, city);
		if (office.size < 8) {
			const upgradeCost = corp.getOfficeSizeUpgradeCost(TOBA, city, 8 - office.size)
			if (corp.getCorporation().funds < upgradeCost) return;
			corp.upgradeOfficeSize(TOBA, city, 8 - office.size);
			office.size = 8;
			ns.print(`Expanded tobacco's office in ${city} to 8.`);
		}
		while (office.numEmployees++ < office.size)
			corp.hireEmployee(TOBA, city);
		unassignCity(ns, TOBA, city);
		corp.setAutoJobAssignment(TOBA, city, JOBS.operations, 1);
		corp.setAutoJobAssignment(TOBA, city, JOBS.engineer, 1);
		corp.setAutoJobAssignment(TOBA, city, JOBS.business, 1);
		corp.setAutoJobAssignment(TOBA, city, JOBS.management, 1);
		corp.setAutoJobAssignment(TOBA, city, JOBS.rnd, 4);
	}

	//Pruchase warehouses
	if (!upgradeWarehousesToSpecificLevel(ns, TOBA, 1)) return;

	//Enable Smart Supply for tobacco
	for (const city of CITIES) {
		corp.setSmartSupply(TOBA, city, true);
		for (const material of constantsData.materialNames)
			corp.setSmartSupplyOption(TOBA, city, material, 'leftovers');
	}

	//Export
	for (const city of CITIES) {
		//Plants
		corp.cancelExportMaterial(AGRI, city, TOBA, city, MATERIALS.plants);
		corp.exportMaterial(AGRI, city, TOBA, city, MATERIALS.plants, EXPORT_STRING);
	}
	ns.print('INFO Configured export routes between agriculture and tobacco.');

	SETUP_DONE = true;
}

/** @param {NS} ns */
function optimizedAutocorp(ns) {
	//WARNING This is specialized for an Agriculture-Chemical-Tobacco combo!

	/*
		<< Tobacco Pre Advert Threshold >>
			Production :      1/23 (0.04) (Smart Factory, Smart Storage, Warehouses)
			Willson/Advert :  4/23 (0.18)
			Offices :         8/23 (0.35)
			Employee Stats:   8/23 (0.35) (NNII, SPI, NA, FW)
			SalesBot :        1/23 (0.04)
			ProjectInsight :  1/23 (0.04)
		<< Tobacco Post Advert Threshold >>
			Production :      1/29 (0.035) (Smart Factory, Smart Storage, Warehouses)
			Willson/Advert : 10/29 (0.345)
			Offices :         8/29 (0.275)
			Employee Stats:   8/29 (0.275) (NNII, SPI, NA, FW)
			SalesBot :        1/29 (0.035)
			ProjectInsight :  1/29 (0.035)
	*/

	//ns.print('Running optimizedAutocorp()');

	//Research
	const corporationData = ns.corporation.getCorporation();
	for (const division of corporationData.divisions) {
		autocorpResearch(ns, division);
	}

	//Unlocks
	if (!ns.corporation.hasUnlock(UNLOCKS.SHADY_ACCOUNTING) && corporationData.funds > ns.corporation.getUnlockCost(UNLOCKS.SHADY_ACCOUNTING) * 10)
		ns.corporation.purchaseUnlock(UNLOCKS.SHADY_ACCOUNTING);
	if (!ns.corporation.hasUnlock(UNLOCKS.GOV_PARTNERSHIP) && corporationData.funds > ns.corporation.getUnlockCost(UNLOCKS.GOV_PARTNERSHIP) * 10)
		ns.corporation.purchaseUnlock(UNLOCKS.GOV_PARTNERSHIP);
	//Pre Advert Threshold
	if (corporationData.revenue - corporationData.expenses < ADVERT_PROFIT_THRESHOLD) {
		//Production
		var productionBudget = corporationData.funds * 0.04 / 3;
		buyUpgradeWithBudget(ns, UPGRADES.SF, productionBudget);
		buyUpgradeWithBudget(ns, UPGRADES.SS, productionBudget);
		//Ads
		let adBudget = corporationData.funds * 0.18;
		adBudget = buyUpgradeWithBudget(ns, UPGRADES.WA, adBudget);
		while (adBudget > 0) {
			const advertCost = ns.corporation.getHireAdVertCost(TOBA);
			//ns.tprint(`Ad Budget = ${ns.formatNumber(adBudget, 1)}, Ad Cost = ${ns.formatNumber(advertCost, 1)}, Can buy = ${advertCost < adBudget}`);
			if (advertCost < adBudget)
				ns.corporation.hireAdVert(TOBA);
			adBudget -= advertCost;
		}
		//Offices
		var officeBudget = corporationData.funds * 0.35;
		//Employee upgrades
		const employeeBudget = officeBudget / 4;
		buyUpgradeWithBudget(ns, UPGRADES.NNII, employeeBudget);
		buyUpgradeWithBudget(ns, UPGRADES.SPI, employeeBudget);
		buyUpgradeWithBudget(ns, UPGRADES.NA, employeeBudget);
		buyUpgradeWithBudget(ns, UPGRADES.FW, employeeBudget);
		//Other upgrades
		const miscBudget = corporationData.funds * 0.04;
		buyUpgradeWithBudget(ns, UPGRADES.SB, miscBudget);
		buyUpgradeWithBudget(ns, UPGRADES.PI, miscBudget);
	}
	//Post Advert Threshold
	else {
		//Production
		var productionBudget = corporationData.funds * 0.035 / 3;
		buyUpgradeWithBudget(ns, UPGRADES.SF, productionBudget);
		buyUpgradeWithBudget(ns, UPGRADES.SS, productionBudget);
		//Ads
		let adBudget = corporationData.funds * 0.345;
		adBudget = buyUpgradeWithBudget(ns, UPGRADES.WA, adBudget);
		while (adBudget > 0) {
			const advertCost = ns.corporation.getHireAdVertCost(TOBA);
			if (advertCost < adBudget)
				ns.corporation.hireAdVert(TOBA);
			adBudget -= advertCost;
		}
		//Offices
		var officeBudget = corporationData.funds * 0.275;
		//Employee upgrades
		const employeeBudget = officeBudget / 4;
		buyUpgradeWithBudget(ns, UPGRADES.NNII, employeeBudget);
		buyUpgradeWithBudget(ns, UPGRADES.SPI, employeeBudget);
		buyUpgradeWithBudget(ns, UPGRADES.NA, employeeBudget);
		buyUpgradeWithBudget(ns, UPGRADES.FW, employeeBudget);
		//Other upgrades
		const miscBudget = corporationData.funds * 0.035;
		buyUpgradeWithBudget(ns, UPGRADES.SB, miscBudget);
		buyUpgradeWithBudget(ns, UPGRADES.PI, miscBudget);
	}

	/*
		-if tobacco rating == max rating then 100% tobacco
		-else if chem quality < sqrt(plant quality) then 100% chem
		-else 100% agri
	*/
	//Decide which division to upgrade
	const tobaccoData = ns.corporation.getDivision(TOBA);
	const productData = ns.corporation.getProduct(TOBA, HQ, tobaccoData.products[0]);	//Must not be the last product
	const chemQuality = ns.corporation.getMaterial(CHEM, HQ, MATERIALS.chemicals).quality;
	const plantQuality = ns.corporation.getMaterial(AGRI, HQ, MATERIALS.plants).quality;

	//If tobacco rating isn't affected by materials improve tobacco
	if (productData.developmentProgress < 100 || productData.rating === productData.effectiveRating) {
		ns.print('Spending funds on tobacco division.');
		autocorpProductDivision(ns, TOBA, officeBudget, productionBudget);
	}
	//If it is affected by chemicals improve chemical
	else if (plantQuality ** 2 < chemQuality) {
		ns.print('Spending funds on chemical division.');
		autocorpMaterialDivision(ns, CHEM, officeBudget, productionBudget);
	}
	//If it is affected by plants improve agriculture
	else {
		ns.print('Spending funds on agriculture division.');
		autocorpMaterialDivision(ns, AGRI, officeBudget, productionBudget);
	}
}

/**
 * @param {NS} ns
 * @param {string} division
 * @param {number} officeBudget
 * @param {number} warehouseBudget
 */
function autocorpMaterialDivision(ns, division, officeBudget, warehouseBudget) {
	/*
		Material division employee ratio
			ops:  17.6   (0.18)
			engi: 50.56   (0.5)
			mng:  11.84  (0.12)
			rnd:  20      (0.2)
	*/
	for (const city of CITIES) {
		//Increase office size
		let officeBudgetLeft = officeBudget / 6;
		while (officeBudgetLeft > 0) {
			const officeUpgradeCost = ns.corporation.getOfficeSizeUpgradeCost(division, city, 1);
			if (officeUpgradeCost > officeBudgetLeft) break;
			ns.corporation.upgradeOfficeSize(division, city, 1);
			officeBudgetLeft -= officeUpgradeCost;
		}
		//Hire to fill empty spots
		const officeData = ns.corporation.getOffice(division, city);
		while (officeData.numEmployees < officeData.size)
			if (ns.corporation.hireEmployee(division, city))
				officeData.numEmployees++;
		//Reassign jobs even if office was not upgraded for safety
		unassignCity(ns, division, city);
		const operationsEmployees = Math.max(Math.floor(officeData.numEmployees * 0.18), 1);
		const managementEmployees = Math.max(Math.floor(officeData.numEmployees * 0.12), 1);
		const rndEmployees = Math.max(Math.floor(officeData.numEmployees * 0.2), 1);
		const engineerEmployees = officeData.numEmployees - operationsEmployees - managementEmployees - rndEmployees; // 0.5
		//ns.print(`DEBUG Tot ${officeData.numEmployees} Ops ${operationsEmployees} Mng ${managementEmployees} RnD ${rndEmployees} Eng ${engineerEmployees}`)
		ns.corporation.setAutoJobAssignment(division, city, JOBS.operations, operationsEmployees);
		ns.corporation.setAutoJobAssignment(division, city, JOBS.engineer, engineerEmployees);
		ns.corporation.setAutoJobAssignment(division, city, JOBS.management, managementEmployees);
		ns.corporation.setAutoJobAssignment(division, city, JOBS.rnd, rndEmployees);
		//Increase warehouse size
		let warehouseBudgetLeft = warehouseBudget / 6 + officeBudgetLeft;
		while (warehouseBudgetLeft > 0) {
			const warehouseUpgradeCost = ns.corporation.getUpgradeWarehouseCost(division, city, 1);
			if (warehouseUpgradeCost > warehouseBudgetLeft) break;
			ns.corporation.upgradeWarehouse(division, city, 1);
			warehouseBudgetLeft -= warehouseUpgradeCost;
		}
	}
}

/**
 * @param {NS} ns
 * @param {string} division
 * @param {number} officeBudget
 * @param {number} warehouseBudget
 */
function autocorpProductDivision(ns, division, officeBudget, warehouseBudget) {
	/*
		<< HQ >>
		Round 3: 
			operations: 0.037
			engineer:   0.513
			business:   0.011
			management: 0.440
		Round 4:
			operations: 0.030
			engineer:   0.531
			business:   0.003
			management: 0.436
		Public (profit < 1e30):
			operations: 0.032
			engineer:   0.462
			business:   0.067
			management: 0.439
		Public (profit > 1e30):
			operations: 0.064
			engineer:   0.317
			business:   0.298
			management: 0.321
		<< Other >>
		Round 3 (no finished products):
			rnd:        1.0
		Round 3 (1+ finished products) & Round 4:
			operations: exactly 1
			engineer:   exactly 1
			business:   exactly 1
			management: exactly 1
			rnd:        everyone else
		Public:
			operations: 0.015
			engineer:   0.2655
			business:   0.0015
			management: 0.218
			rnd:        0.5
	*/
	//Calculate office budget split
	const round = ns.corporation.getInvestmentOffer().round ?? 5;
	const corporationData = ns.corporation.getCorporation();
	const profit = corporationData.revenue - corporationData.expenses;
	const hqOfficeBudget = (round === 3) ? officeBudget * 0.75 : officeBudget * 0.5;

	//HQ logic
	let hqOfficeBudgetLeft = hqOfficeBudget;
	while (hqOfficeBudgetLeft > 0) {
		const upgradeCost = ns.corporation.getOfficeSizeUpgradeCost(division, HQ, 1);
		if (upgradeCost > hqOfficeBudgetLeft) break;
		ns.corporation.upgradeOfficeSize(division, HQ, 1);
		hqOfficeBudgetLeft -= upgradeCost;
	}
	//Hire to fill empty spots
	const officeData = ns.corporation.getOffice(division, HQ);
	while (officeData.numEmployees < officeData.size)
		if (ns.corporation.hireEmployee(division, HQ))
			officeData.numEmployees++;
	//Reassign jobs even if office was not upgraded for safety
	unassignCity(ns, division, HQ);
	if (round === 3) {
		const operationsEmployees = Math.max(Math.floor(officeData.numEmployees * 0.037), 1);
		const businessEmployees = Math.max(Math.floor(officeData.numEmployees * 0.011), 1);
		const managementEmployees = Math.max(Math.floor(officeData.numEmployees * 0.440), 1);
		const engineerEmployees = officeData.numEmployees - operationsEmployees - businessEmployees - managementEmployees; // 0.513
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.operations, operationsEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.engineer, engineerEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.business, businessEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.management, managementEmployees);
	}
	else if (round === 4) {
		const operationsEmployees = Math.max(Math.floor(officeData.numEmployees * 0.03), 1);
		const businessEmployees = Math.max(Math.floor(officeData.numEmployees * 0.003), 1);
		const managementEmployees = Math.max(Math.floor(officeData.numEmployees * 0.436), 1);
		const engineerEmployees = officeData.numEmployees - operationsEmployees - businessEmployees - managementEmployees; // 0.531
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.operations, operationsEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.engineer, engineerEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.business, businessEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.management, managementEmployees);
	}
	else if (profit < 1e30) {
		const operationsEmployees = Math.max(Math.floor(officeData.numEmployees * 0.032), 1);
		const businessEmployees = Math.max(Math.floor(officeData.numEmployees * 0.067), 1);
		const managementEmployees = Math.max(Math.floor(officeData.numEmployees * 0.439), 1);
		const engineerEmployees = officeData.numEmployees - operationsEmployees - businessEmployees - managementEmployees; // 0.462
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.operations, operationsEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.engineer, engineerEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.business, businessEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.management, managementEmployees);
	}
	else {
		const operationsEmployees = Math.max(Math.floor(officeData.numEmployees * 0.064), 1);
		const businessEmployees = Math.max(Math.floor(officeData.numEmployees * 0.298), 1);
		const managementEmployees = Math.max(Math.floor(officeData.numEmployees * 0.321), 1);
		const engineerEmployees = officeData.numEmployees - operationsEmployees - businessEmployees - managementEmployees; // 0.317
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.operations, operationsEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.engineer, engineerEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.business, businessEmployees);
		ns.corporation.setAutoJobAssignment(division, HQ, JOBS.management, managementEmployees);
	}

	//Non HQ logic
	const nonHQOfficeBudgetPerCity = (officeBudget - hqOfficeBudget + hqOfficeBudgetLeft) / 5;
	for (const city of CITIES) {
		if (city == HQ) continue;
		let thisOfficeBudget = nonHQOfficeBudgetPerCity;
		while (thisOfficeBudget > 0) {
			const upgradeCost = ns.corporation.getOfficeSizeUpgradeCost(division, city, 1);
			if (upgradeCost > thisOfficeBudget) break;
			ns.corporation.upgradeOfficeSize(division, city, 1);
			thisOfficeBudget -= upgradeCost;
		}
		//Hire to fill empty spots
		const officeData = ns.corporation.getOffice(division, city);
		while (officeData.numEmployees < officeData.size)
			if (ns.corporation.hireEmployee(division, city))
				officeData.numEmployees++;
		//Reassign jobs even if office was not upgraded for safety
		unassignCity(ns, division, city);
		if (round < 5) {
			ns.corporation.setAutoJobAssignment(division, city, JOBS.operations, 1);
			ns.corporation.setAutoJobAssignment(division, city, JOBS.engineer, 1);
			ns.corporation.setAutoJobAssignment(division, city, JOBS.business, 1);
			ns.corporation.setAutoJobAssignment(division, city, JOBS.management, 1);
			ns.corporation.setAutoJobAssignment(division, city, JOBS.rnd, officeData.numEmployees - 4);
		}
		else {
			ns.corporation.setAutoJobAssignment(division, city, JOBS.operations, Math.ceil(officeData.numEmployees * 0.015));
			ns.corporation.setAutoJobAssignment(division, city, JOBS.engineer, Math.ceil(officeData.numEmployees * 0.2655));
			ns.corporation.setAutoJobAssignment(division, city, JOBS.business, Math.ceil(officeData.numEmployees * 0.0015));
			ns.corporation.setAutoJobAssignment(division, city, JOBS.management, Math.ceil(officeData.numEmployees * 0.218));
			ns.corporation.setAutoJobAssignment(division, city, JOBS.rnd, Math.ceil(officeData.numEmployees * 0.5));
		}
	}

	//Warehouses
	for (const city of CITIES) {
		let cityWarehouseBudget = warehouseBudget / 6;
		while (cityWarehouseBudget > 0) {
			const warehouseCost = ns.corporation.getUpgradeWarehouseCost(division, city, 1);
			if (warehouseCost > cityWarehouseBudget) break;
			ns.corporation.upgradeWarehouse(division, city, 1);
			cityWarehouseBudget -= warehouseCost;
		}
	}
}

/**
 * @param {NS} ns
 * @param {string} division
 * @param {number} budget
 */
function autocorpResearch(ns, division) {
	//If round 3 skip
	//if (ns.corporation.getInvestmentOffer().round === 3) return;
	//Get data
	const hasResearched = ns.corporation.hasResearched;
	const getResearchCost = ns.corporation.getResearchCost;
	const divisionData =  ns.corporation.getDivision(division);
	let researchPoints = divisionData.researchPoints;
	let currentCost = 0;
	//Spend hashes if under 10k research
	if (researchPoints < 10e3) {
		const amountOfResearchToBuy = Math.max(10 - Math.floor(researchPoints / 1000), 0); //Enough to go over 10k
		buyResearchWithHashes(ns, amountOfResearchToBuy);
		researchPoints = ns.corporation.getDivision(division).researchPoints;
	}
	//Setup filters
	const EMPLOYEE_RESEARCH = [RESEARCH.overclock, RESEARCH.stimu,
		RESEARCH.autodrug, RESEARCH.juice, RESEARCH.injections,
		RESEARCH.autobrew, RESEARCH.autoparty];
	const PRODUCTION_RESEARCH = [RESEARCH.fulcrum, RESEARCH.assemblers, 
		RESEARCH.drones, RESEARCH.droneAssembly, RESEARCH.droneTransport];
	//If you can afford, get lab
	currentCost = getResearchCost(division, RESEARCH.lab);
	if (!hasResearched(division, RESEARCH.lab)) {
		if (researchPoints >= currentCost) {
			ns.corporation.research(division, RESEARCH.lab);
			researchPoints -= currentCost;
		}
		else return;
	}
	//If research >= (ta1 + ta2) * 2 get those
	currentCost = getResearchCost(division, RESEARCH.marketI) + getResearchCost(division, RESEARCH.marketII);
	if (!hasResearched(division, RESEARCH.marketII)) {
		if (researchPoints >= currentCost * 2) {
			ns.corporation.research(division, RESEARCH.marketI);
			ns.corporation.research(division, RESEARCH.marketII);
			ns.print(`INFO Unlocked Market-TA2 for ${division}.`);
			const divisionData = ns.corporation.getDivision(division);
			if (divisionData.makesProducts)
				for (const product of divisionData.products)
					ns.corporation.setProductMarketTA2(division, product, true);
			for (const city of CITIES)
				for (const material of ns.corporation.getConstants().materialNames)
					ns.corporation.setMaterialMarketTA2(division, city, material, true);
			researchPoints -= currentCost;
		}
		else return;
	}
	//Stop here if round 3
	if (ns.corporation.getInvestmentOffer().round === 3) return;
	//If research >= any employee * 5 get it
	for (const employeeResearch of EMPLOYEE_RESEARCH) {
		if (hasResearched(division, employeeResearch)) continue;
		currentCost = getResearchCost(division, employeeResearch);
		if (researchPoints >= currentCost * 5) {
			ns.corporation.research(division, employeeResearch);
			researchPoints -= currentCost;
		}
		else break;
	}
	//If research >= any prod * 10 get it
	for (const productionResearch of PRODUCTION_RESEARCH) {
		if (hasResearched(division, productionResearch)) continue;
		if (productionResearch === RESEARCH.fulcrum && !divisionData.makesProducts) continue;
		currentCost = getResearchCost(division, productionResearch);
		if (researchPoints >= currentCost * 10) {
			ns.corporation.research(division, productionResearch);
			researchPoints -= currentCost;
		}
		else break;
	}
}

/** 
 * @param {NS} ns 
 * @param {string} division
 */
function loadProductCount(ns, division) {
	if (!ns.corporation.getCorporation().divisions.includes(division)) {
		PRODUCT_COUNT = 0;
		return;
	}
	const products = ns.corporation.getDivision(division).products;
	if (products.length === 0) {
		PRODUCT_COUNT = 0;
		return;
	}
	else {
		const lastProductName = products[products.length-1];
		const lastProductNumber = lastProductName.slice(division.length + 1);
		PRODUCT_COUNT = Number.parseInt(lastProductNumber) + 1;
	}
	LAST_PRODUCT_NAME = products[products.length - 1];
	ns.print(`INFO Loaded product count ${PRODUCT_COUNT} and last product name ${LAST_PRODUCT_NAME}`);
}

/** 
 * @param {NS} ns 
 * @param {string} division
 * @return {boolean}
 */
function startProductDevelopment(ns, division) {
	//Calculate funding (~2%)
	const funds = ns.corporation.getCorporation().funds * 0.01;
	//Pick a name
	const productName = `${division}-${PRODUCT_COUNT}`;
	PRODUCT_COUNT++;
	ns.corporation.makeProduct(division, HQ, productName, funds, funds);
	LAST_PRODUCT_NAME = productName;
	ns.printf('Started developing product %s.', productName);
	return true;
}

/** @param {NS} ns */
async function autocorpProduct(ns) {
	//WARN This function is meant for tobacco only]
	//If we reached soft cap there is no reason do develop more
	if (ns.corporation.getCorporation().revenue >= 1e99 ** ns.getBitNodeMultipliers().CorporationSoftcap) return;
	//If there is a product developing do nothing
	const productData = ns.corporation.getProduct(TOBA, HQ, LAST_PRODUCT_NAME);
	if (productData.developmentProgress < 100) return;
	ns.print(`INFO Completed development of ${LAST_PRODUCT_NAME}`);
	//If the development finished find a good price
	await findProductPrice(ns, TOBA, LAST_PRODUCT_NAME);
	//Discontinue oldest product
	const products = ns.corporation.getDivision(TOBA).products;
	if (products.length >= 3) {
		ns.corporation.discontinueProduct(TOBA, products[0]);
		ns.print(`Discontinued ${products[0]}.`);
	}
	//Start development of new product
	startProductDevelopment(ns, TOBA)
}

/**
 * @param {NS} ns
 * @param {string} division
 * @param {string} productName
 */
async function findProductPrice(ns, division, productName) {
	if (ns.corporation.hasResearched(division, RESEARCH.marketII)) {
		ns.corporation.setProductMarketTA2(division, productName, true);
		return;
	}
	let productData;
	let multiplier = 1;
	let priceString = MP;
	await waitForState(ns, STATES.START);
	//Double until there is unsold material
	do {
		multiplier *= 2;
		priceString = `MP*${multiplier}`;
		ns.corporation.sellProduct(division, HQ, productName, MAX, priceString);
		ns.print(`Testing price ${priceString} for ${productName}.`);
		await waitForState(ns, STATES.SALE);
		productData = ns.corporation.getProduct(division, HQ, productName);
		//ns.print(`Unsold amount: ${ns.formatNumber(productData.stored)}`);
	} while (productData.stored === 0);
	multiplier /= 2;

	//Clear unsold inventory
	ns.print(`Clearing inventory before continuing testing.`);
	ns.corporation.sellProduct(division, HQ, productName, MAX, MP);
	while (ns.corporation.getProduct(division, HQ, productName).stored > 0)
		await waitForState(ns, STATES.SALE);
	
	//Test with % granularity
	const granularity = multiplier / 10; //10% rounded down
	do {
		multiplier += granularity;
		priceString = `MP*${multiplier.toFixed(1)}`;
		ns.corporation.sellProduct(division, HQ, productName, MAX, priceString);
		ns.print(`Testing price ${priceString} for ${productName}.`);
		await waitForState(ns, STATES.SALE);
		productData = ns.corporation.getProduct(division, HQ, productName);
		//ns.print(`Unsold amount: ${ns.formatNumber(productData.stored)}`);
	} while (productData.stored === 0);
	multiplier -= granularity * 1.5;

	if (multiplier <= 1) priceString = MP;
	else priceString = `MP*${multiplier.toFixed(1)}`;
	ns.corporation.sellProduct(division, HQ, productName, MAX, priceString, true);
	ns.print(`Chosen price ${priceString} for ${productName}.`);
	ns.tprint(`Chosen price ${priceString} for ${productName}.`);
}

/**
 * @param {NS} ns
 * @param {string} state
 */
async function waitForState(ns, state) {
	let lastState = 'None';
	while (lastState !== state)
		lastState = await ns.corporation.nextUpdate();
}

/** @param {NS} ns */
function drinkTeaAndThrowParty(ns, division, threshold = 99) {
	if (ns.corporation.hasResearched(division, RESEARCH.autobrew) && ns.corporation.hasResearched(division, RESEARCH.autoparty)) return;
	const divisionCities = ns.corporation.getDivision(division).cities;
	const energyThreshold = (ns.corporation.hasResearched(division, RESEARCH.juice)) ? threshold + 10 : threshold;
	const moraleThreshold = (ns.corporation.hasResearched(division, RESEARCH.stimu)) ? threshold + 10 : threshold;
	const drankTea = [];
	const threwParty  = [];
	for (const city of divisionCities) {
		const officeData = ns.corporation.getOffice(division, city);
		if (officeData.avgEnergy < energyThreshold)
			if (ns.corporation.buyTea(division, city))
				drankTea.concat(city);
				
		if (officeData.avgMorale < moraleThreshold)
			if (ns.corporation.throwParty(division, city, 500e3))
				threwParty.concat(city);
			
	}
	if (drankTea.length > 0)
		ns.print(`Purchased tea in ${drankTea}`);
	if (threwParty.length > 0)
		ns.print(`Threw parties in ${drankTea}`);
}

/** @param {NS} ns */
function unassignAll(ns, division) {
	for (const city of CITIES)
		unassignCity(ns, division, city);
}

/** @param {NS} ns */
function unassignCity(ns, division, city) {
	for (const position of ns.corporation.getConstants().employeePositions)
		ns.corporation.setAutoJobAssignment(division, city, position, 0);
}

/** 
 * @param {NS} ns 
 * @param {string} division
 * @param {number} targetLevel
 * @return {boolean}
 */
function upgradeWarehousesToSpecificLevel(ns, division, targetLevel) {
	for (const city of CITIES) {
		//Unlock warehouse if missing
		let funds = corp.getCorporation().funds;
		if (!corp.hasWarehouse(division, city)) {
			if (funds < 5e9) {
				ns.print(`WARN Insufficient funds to purchase ${division}'s warehouse in ${city} (${ns.formatNumber(funds, 1)} / 5b).`);
				return false;
			}
			corp.purchaseWarehouse(division, city);
			funds -= 5e9;
			ns.print(`INFO Purchased ${division}'s warehouse in ${city}.`);
		}
		//Upgrade warehouse level
		const warehouse = corp.getWarehouse(division, city);
		if (warehouse.level < targetLevel) {
			const levesToPurchase = targetLevel - warehouse.level;
			const upgradeCost = corp.getUpgradeWarehouseCost(division, city, levesToPurchase);
			if (funds < upgradeCost) {
				ns.print(`WARN Insufficient funds to level up ${division}'s warehouse (${ns.formatNumber(funds, 1)} / ${ns.formatNumber(upgradeCost, 1)}).`);
				return false;
			} 
			corp.upgradeWarehouse(division, city, levesToPurchase);
			ns.print(`INFO Upgraded ${division}'s warehouse in ${city} to level ${targetLevel}.`);
		}
		//else ns.print(`${division}'s warehouse in ${city} already reached level ${targetLevel}.`);
	}
	return true;
}

/** 
 * @param {NS} ns 
 * @param {string} division
 * @param {number} targetLevel
 * @return {boolean}
 */
function buyAdVertsToSpecificCount(ns, division, targetLevel) {
	if (ns.corporation.getHireAdVertCount(division) >= targetLevel) {
		//ns.print(`${division} already reached AdVert level ${targetLevel}.`);
		return true;
	}
	let funds = ns.corporation.getCorporation().funds;
	while (ns.corporation.getHireAdVertCount(division) < targetLevel) {
		const advertCost = ns.corporation.getHireAdVertCost(division);
		if (funds < advertCost) {
			ns.print(`WARN Insufficient funds to level up ${division}'s AdVert (${ns.formatNumber(funds, 1)} / ${ns.formatNumber(advertCost, 1)}).`);
			return false;
		}
		ns.corporation.hireAdVert(division);
		funds -= advertCost;
		ns.print(`INFO Upgraded ${division}'s AdVert to level ${ns.corporation.getHireAdVertCount(division)}.`);
	}
	return true;
}

/** 
 * @param {NS} ns 
 * @param {string} upgrade
 * @param {number} targetCount
 * @return {boolean}
 */
function buyUpgradeToSpecificCount(ns, upgrade, targetCount) {
	if (ns.corporation.getUpgradeLevel(upgrade) >= targetCount) {
		//ns.print(`${upgrade} already at level ${targetCount}.`);
		return true;
	}
	let funds = ns.corporation.getCorporation().funds;
	while (ns.corporation.getUpgradeLevel(upgrade) < targetCount) {
		const upgradeCost = ns.corporation.getUpgradeLevelCost(upgrade);
		if (funds < upgradeCost) {
			ns.print(`WARN Insufficient funds to level up ${upgrade} (${ns.formatNumber(funds, 1)} / ${ns.formatNumber(upgradeCost, 1)}).`);
			return false;
		}
		ns.corporation.levelUpgrade(upgrade);
		funds -= upgradeCost;
		ns.print(`INFO Upgraded ${upgrade} to level ${ns.corporation.getUpgradeLevel(upgrade)}.`);
	}
	return true;
}

/** 
 * @param {NS} ns 
 * @param {string} upgrade
 * @param {number} budget
 * @return {number} Budget not spent
 */
function buyUpgradeWithBudget(ns, upgrade, budget) {
	let upgradeCost = 0;
	let remainingBudget = budget;
	do {
		upgradeCost = ns.corporation.getUpgradeLevelCost(upgrade);
		if (upgradeCost > remainingBudget) break;
		ns.corporation.levelUpgrade(upgrade);
		remainingBudget -= upgradeCost;
	} while (remainingBudget > upgradeCost) //Cost goes up, if you cannot afford last you cannot afford current
	return remainingBudget;
}

/** 
 * @param {NS} ns
 * @param {number} amount
 * @return {boolean}
 */
function buyResearchWithHashes(ns, amount = 1) {
	let amountBought = 0;
	while (amountBought < amount) {
		if (ns.hacknet.numHashes() > ns.hacknet.hashCost(HASH_RESEARCH)) {
			ns.hacknet.spendHashes(HASH_RESEARCH);
			amountBought++;
		}
		else return false;
	}
	return true;
}

/** @param {NS} ns */
function report(ns) {
	//╔═╗╚╝║╠╣╟╢╤╧╪─│┬┴┼▲▼■□
	//Header
	ns.print('╔═════════════╤══════════╤════════════╤═════════════╗');
	ns.print('║ Jormungandr │ Research │ Net Profit │ Development ║');
	ns.print('╟─────────────┼──────────┼────────────┼─────────────╢');
	//Dynamic
	const corporationData = ns.corporation.getCorporation();
	for (const division of corporationData.divisions) {
		const divisionData = ns.corporation.getDivision(division);
		const cutDivision = (division.length > 11)
			? division.slice(0, 8) + '...'
			: division;
		const paddedDivision = cutDivision.padStart(Math.ceil((11 - cutDivision.length) / 2 + cutDivision.length), ' ').padEnd(11, ' ');
		const researchPoints = ns.formatNumber(divisionData.researchPoints, 2).padStart(8, ' ');
		const profit = divisionData.lastCycleRevenue - divisionData.lastCycleExpenses;
		const formattedProfit = formatNumberCustom(profit, 2).padStart(10, ' ');
		let productProgression = (divisionData.products.length === 0)
			? '[/////////]'
			: `[${''.padStart(Math.min(Math.floor(ns.corporation.getProduct(division, HQ, LAST_PRODUCT_NAME).developmentProgress / 10), 9), '■').padEnd(9, '_')}]`;
		ns.print(`║ ${paddedDivision} │ ${researchPoints} │ ${formattedProfit} │ ${productProgression} ║`);
	}
	//Footer
	const getLevel = ns.corporation.getUpgradeLevel;
	const constantsData = ns.corporation.getConstants();
	const unlocksOwned = constantsData.unlockNames.reduce((total, current) => (ns.corporation.hasUnlock(current)) ? total + 1 : total, 0);
	const totalProfit = corporationData.revenue - corporationData.expenses
	const formattedTotalProfit = ('$'+formatNumberCustom(totalProfit, (totalProfit < 1e33) ? 1 : 0)).padStart(7, ' ');
	const funds = formatNumberCustom(corporationData.funds, 0, true).padStart(4, ' ');
	const levels = {};
	for (const key of Object.keys(UPGRADES))
		levels[key] = Math.min(getLevel(UPGRADES[key]), 99).toString().padStart(2, ' ');
	ns.print('╟────┬────┬───┴┬────┬────┼────┬────┬──┴─┬──────┬────╢');
	ns.print(`║ SF │ ${levels.SF} │ WA │ ${levels.WA} │ PI │ ${levels.PI} │ NA │ ${levels.NA} │  SPI │ ${levels.SPI} ║`);
	ns.print('╟────┼────┼────┼────┼────┼────┼────┼────┼──────┼────╢');
	ns.print(`║ SS │ ${levels.SS} │ DS │ ${levels.DS} │ SB │ ${levels.SB} │ FW │ ${levels.FW} │ NNII │ ${levels.NNII} ║`);
	ns.print('╠════╧════╪════╧╤═══╧════╪════╧════╧═╤══╧════╤═╧════╣');
	ns.print(`║ Unlocks │ ${unlocksOwned}/${constantsData.unlockNames.length} │ Profit │ ${formattedTotalProfit}/s │ Funds │ ${funds} ║`);
	ns.print('╚═════════╧═════╧════════╧═══════════╧═══════╧══════╝');
	//Resize
	//Possible width 9.735 * characters
	ns.resizeTail(516, 16 * (12 + corporationData.divisions.length));
	compactTail(ns.getScriptName());
}