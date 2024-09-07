/** 
 * @param {NS} ns
 * @param {string} division
 * @param {CityName} city
 * @param {CorpMaterialName} material
 */
export function materialMarketTA2(ns, division, city, material) {
	const materialData = ns.corporation.getMaterial(division, city, material);
	//Calculate multipliers
	const qualityFactor = materialData.quality + 0.001;
	//Business factor
	const businessProduction = officeData.employeeProductionByJob.Business + 1;
	const businessFactor = (businessProduction ** 0.26) + (businessProduction / 1000);
	//Advert factor
	const advertisingFactor = getAdvertisingFactor(divisionData.type);
	const awarenessFactor = (divisionData.awareness + 1) ** advertisingFactor;
	const popularityFactor = (divisionData.popularity + 1) ** advertisingFactor;
	const ratioFactor = (awarenessFactor !== 0)
		? Math.max((divisionData.popularity + 0.001) / divisionData.awareness, 0.01)
		: 0.01;
	const advertFactor = (awarenessFactor * popularityFactor * ratioFactor) ** 0.85;
	//Market Factor
	const marketFactor = Math.max(materialData.demand * (100 - materialData.competition) / 100, 0.1);
	//Salesbot Factor
	const salesbotFactor = ns.corporation.getUpgradeLevel('ABC SalesBots') * 0.01 + 1;
	//Find selling price
	const finalMultiplier = qualityFactor * businessFactor * advertFactor * marketFactor * salesbotFactor;
	throw new Error();
}

/** 
 * @param {NS} ns
 * @param {string} division
 * @param {CityName} city
 * @param {string} product
 */
export function productMarketTA2(ns, division, city, product) {
	const divisionData = ns.corporation.getDivision(division);
	const officeData = ns.corporation.getOffice(division, city);
	const productData = ns.corporation.getProduct(division, city, product);
	const expectedSalesVolume = productData.productionAmount / 10;
	//Quality factor
	const qualityFactor = (productData.effectiveRating ** 0.65) * 0.5;
	//Business factor
	const businessProduction = officeData.employeeProductionByJob.Business + 1;
	const businessFactor = (businessProduction ** 0.26) + (businessProduction / 1000);
	//Advert factor
	const advertisingFactor = getAdvertisingFactor(divisionData.type);
	const awarenessFactor = (divisionData.awareness + 1) ** advertisingFactor;
	const popularityFactor = (divisionData.popularity + 1) ** advertisingFactor;
	const ratioFactor = (awarenessFactor !== 0)
		? Math.max((divisionData.popularity + 0.001) / divisionData.awareness, 0.01)
		: 0.01;
	const advertFactor = (awarenessFactor * popularityFactor * ratioFactor) ** 0.85;
	//Market Factor
	const marketFactor = Math.max(productData.demand * (100 - productData.competition) / 100, 0.1);
	//Salesbot Factor
	const salesbotFactor = ns.corporation.getUpgradeLevel('ABC SalesBots') * 0.01 + 1;
	//Find selling price
	const finalMultiplier = qualityFactor * businessFactor * advertFactor * marketFactor * salesbotFactor;
	//use exploit to read product markup
	throw new Error();
}

/**
 * @param {IndustryName} industryType
 * @return {number}
 */
function getAdvertisingFactor(industryType) {
	throw new Error();
}