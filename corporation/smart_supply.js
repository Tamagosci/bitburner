const INDUSTRIES = {
	agriculture: 'Agriculture',
	chemical: 'Chemical',
	tobacco: 'Tobacco'
};

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

const DEBUG = false;

/** @param {NS} ns */
export function fakeSmartSupply(ns) {
	const corporationData = ns.corporation.getCorporation();
	for (const division of corporationData.divisions) {
		const divisionData = ns.corporation.getDivision(division);
		const rawProductionData = calculateRawProduction(ns, division);
		for (const city of divisionData.cities) {
			if (!ns.corporation.hasWarehouse(division, city)) continue;
			const warehouseData = ns.corporation.getWarehouse(division, city);
			const rawProductionPerSecond = rawProductionData[city];
			const storageRequired = calculateStorageRequired(divisionData.type, rawProductionPerSecond) * 10;
			const freeStorage = warehouseData.size - warehouseData.sizeUsed;
			const actualProductionPerSecond = (rawProductionPerSecond > 0)
				? Math.min(rawProductionPerSecond, rawProductionPerSecond * freeStorage / storageRequired)
				: 0;
			if (DEBUG) ns.print(`DEBUG Division ${division} city ${city} estimated production ${actualProductionPerSecond} / ${rawProductionPerSecond}`);
			setSmartSupplyPurchase(ns, divisionData.type, division, city, actualProductionPerSecond * 10);
		}
	}
}

/**
 * @param {NS} ns
 * @param {string} division
 * @param {CityName} city
 * @return {{CityName: number}}
 */
function calculateRawProduction(ns, division) {
	//Materials multiplier
	const materialsMultiplier = calculateMaterialsMultiplier(ns, division);

	//Smart Factory multiplier
	const factoryMultiplier = ns.corporation.getUpgradeLevel('Smart Factories') * 0.03 + 1;

	//Research multiplier
	let researchMultiplier = 1;
	if (ns.corporation.hasResearched(division, 'Self-Correcting Assemblers')) researchMultiplier *= 1.1;
	if (ns.corporation.hasResearched(division, 'Drones - Assembly')) researchMultiplier *= 1.2;

	//Office multiplier
	const divisionData = ns.corporation.getDivision(division);
	const rawProductionData = {};
	for (const city of divisionData.cities) {
		const officeData = ns.corporation.getOffice(division, city);
		const officeMultiplier = calculateOfficeMultiplier(officeData, divisionData.makesProducts);
		rawProductionData[city] = materialsMultiplier * factoryMultiplier * researchMultiplier * officeMultiplier;
		if (DEBUG) ns.print(`DEBUG City ${city} Material ${materialsMultiplier} Factories ${factoryMultiplier} Research ${researchMultiplier} Office ${officeMultiplier}`)
	}

	return rawProductionData;
}

/**
 * @param {Office} officeData
 * @param {boolean} isOutputProduct
 * @return {number}
 */
function calculateOfficeMultiplier(officeData, isOutputProduct = false) {
	const operationsProduction = officeData.employeeProductionByJob.Operations
	const engineerProduction = officeData.employeeProductionByJob.Engineer;
	const managementProduction = officeData.employeeProductionByJob.Management;
	const employeeProduction = operationsProduction + engineerProduction + managementProduction;
	const managementFactor = 1 + (managementProduction / (1.2 * employeeProduction));
	const employeeProductionMultiplier = (operationsProduction ** 0.4 + engineerProduction ** 0.3) * managementFactor;
	let officeMultiplier = 0.05 * employeeProductionMultiplier;
	if (isOutputProduct) officeMultiplier *= 0.5;
	return officeMultiplier;
}

/**
 * @param {NS} ns
 * @param {string} division
 * @return {number}
 */
function calculateMaterialsMultiplier(ns, division) {
	const divisionData = ns.corporation.getDivision(division);
	const coefficients = getIndustryCoefficients(divisionData.type);
	let materialsMultiplier = 0;
	for (const city of divisionData.cities) {
		if (!ns.corporation.hasWarehouse(division, city)) continue;
		const coresMultiplier = (ns.corporation.getMaterial(division, city, MATERIALS.cores).stored * 0.002 + 1) ** coefficients.cores;
		const hardwareMultiplier = (ns.corporation.getMaterial(division, city, MATERIALS.hardware).stored * 0.002 + 1) ** coefficients.hardware;
		const estateMultiplier = (ns.corporation.getMaterial(division, city, MATERIALS.estate).stored * 0.002 + 1) ** coefficients.estate;
		const robotMultiplier = (ns.corporation.getMaterial(division, city, MATERIALS.robots).stored * 0.002 + 1) ** coefficients.robots;
		const cityMultiplier = (coresMultiplier * hardwareMultiplier * estateMultiplier * robotMultiplier) ** 0.73;
		if (cityMultiplier < 1) cityMultiplier = 1;
		materialsMultiplier += cityMultiplier;
	}
	return materialsMultiplier;
}

/**
 * @param {CorpIndustryName} divisionType
 * @return {{string:number}}
 */
function getIndustryCoefficients(divisionType) {
	let coreCoefficient = 0;
	let hardwareCoefficient = 0;
	let estateCoefficient = 0;
	let robotCoefficient = 0;

	switch (divisionType) {
		case INDUSTRIES.agriculture:
			coreCoefficient = 0.3;
			hardwareCoefficient = 0.2;
			estateCoefficient = 0.72;
			robotCoefficient = 0.3;
			break;
		case INDUSTRIES.chemical:
			coreCoefficient = 0.2;
			hardwareCoefficient = 0.2;
			estateCoefficient = 0.25;
			robotCoefficient = 0.25;
			break;
		case INDUSTRIES.tobacco:
			coreCoefficient = 0.15;
			hardwareCoefficient = 0.15;
			estateCoefficient = 0.15;
			robotCoefficient = 0.25;
			break;
		default:
			throw new Error(`Tried to calculate division multiplier for unimplemented industry ${divisionType}`);
	}

	return {
		cores: coreCoefficient,
		hardware: hardwareCoefficient,
		estate: estateCoefficient,
		robots: robotCoefficient
	};
}

/**
 * @param {CorpIndustryName} industryType
 * @param {number} rawProduction
 * @return {number}
 */
function calculateStorageRequired(industryType, rawProduction) {
	switch (industryType) {
		case INDUSTRIES.agriculture:
			return rawProduction * (MATERIALS_SIZE.plants + MATERIALS_SIZE.food);
		case INDUSTRIES.chemical:
			return rawProduction * (MATERIALS_SIZE.chemicals);
		default:
			throw new Error(`Attempted to calculate storage requirements of unsupported industry ${industryType}`);
	}
}

/**
 * @param {NS} ns
 * @param {IndustryName} divisionType
 * @param {string} division
 * @param {CityName} city
 * @param {number} productionPerCycle
 * @return {number}
 */
function setSmartSupplyPurchase(ns, divisionType, division, city, productionPerCycle) {
	const materialRatios = [];
	
	switch (divisionType) {
		case INDUSTRIES.agriculture:
			materialRatios[0] = [MATERIALS.water, 0.5];
			materialRatios[1] = [MATERIALS.chemicals, 0.2];
			break;
		case INDUSTRIES.chemical:
			materialRatios[0] = [MATERIALS.water, 0.5];
			materialRatios[1] = [MATERIALS.plants, 1.0];
			break;
		default:
			throw new Error(`Attempted to set Smart Supply of unsupported industry ${industryType}`);
	}

	for (const [material, ratio] of materialRatios) {
		//Account for existing materials
		const materialData = ns.corporation.getMaterial(division, city, material);
		let purchasePerSecond = productionPerCycle / 10 * ratio;
		if (materialData.stored > 0) purchasePerSecond -= materialData.stored / 10;
		if (DEBUG) ns.print(`DEBUG Division ${division} city ${city} set Smart Supply to ${purchasePerSecond.toFixed(2)} ${material} per second`)
		if (purchasePerSecond > 0) {
			ns.corporation.buyMaterial(division, city, material, purchasePerSecond);
			ns.corporation.sellMaterial(division, city, material, 0, 0);
		}
		else {
			ns.corporation.buyMaterial(division, city, material, 0);
			ns.corporation.sellMaterial(division, city, material, purchasePerSecond * -1, 'MP');
		}
	}
}