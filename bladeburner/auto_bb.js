import { formatTime, compactTail } from 'utils.js'

const ACTIONS = {
	training: 'Training', 
	analysis: 'Field Analysis',
	recruit: 'Recruitment',
	diplomacy: 'Diplomacy',
	regen: 'Hyperbolic Regeneration Chamber',
	incite: 'Incite Violence'
}

const CONTRACTS = {
	track: 'Tracking',
	capture: 'Bounty Hunter',
	kill: 'Retirement'
}

const OPERATIONS = {
	investigate: 'Investigation',
	undercover: 'Undercover Operation',
	sting: 'Sting Operation',
	raid: 'Raid',
	stealthKill: 'Stealth Retirement Operation',
	assassinate: 'Assassination'
}

const ACTION_TYPES = {
	action: 'General', 
	contract: 'Contracts',
	operation: 'Operations',
	blackops: 'Black Operations'
}

const CITIES = ['Aevum', 'Chongqing', 'Sector-12', 'New Tokyo', 'Ishima', 'Volhaven']

const MIN_STAMINA = 40
const MAX_CITY_CHAOS = 50
const MAX_CITY_POP = Infinity
const MIN_CITY_POP = 1e9
const MAX_ACTIONS_SINCE_ANALYSIS = 55
const MIN_SUCCESS_ACCURACY = 0.99
const MIN_CONTRACT_SUCCESS_CHANCE = 0.8
const MIN_OPERATION_SUCCESS_CHANCE = 0.9
const MIN_BLACKOPS_SUCCESS_CHANCE = 1

let needAnalysis = false
let needViolence = false

/** @param {NS} ns */
export async function main(ns) {
	await autoBladeburner(ns)
}

/** @param {NS} ns */
export async function autoBladeburner(ns) {
	//Join BB or close
	if (!ns.bladeburner.inBladeburner()) {
		if (!ns.bladeburner.joinBladeburnerDivision()) {
			ns.print('Failed to join the Bladeburner division, shutting down...')
			return
		}
	}

	//Logging
	ns.tail()
	ns.disableLog('ALL')
	ns.clearLog()

	/*
	//Setup
	const nodeMultipliers = ns.getBitNodeMultipliers()
	const actionsSinceAnalysis = {
		'Aevum': Infinity, 
		'Chongqing': Infinity, 
		'Sector-12': Infinity, 
		'New Tokyo': Infinity, 
		'Ishima': Infinity, 
		'Volhaven': Infinity
	}
	*/

	//If already doing something, wait until done
	{	//Don't want currentAction in the scope
		const currentAction = ns.bladeburner.getCurrentAction()
		if (currentAction !== null) {
			const sleepTime = calculateSleepTime(ns)
			ns.print(`Detected ongoing action ${currentAction.name}, waiting ${formatTime(sleepTime)}`)
			report(ns)
			await ns.sleep(sleepTime + 200)
		}
	}

	//Core loop
	while (true) {
		ns.print('\n')
		needAnalysis = false
		needViolence = false

		const cityData = getBestCityData(ns)
		ns.bladeburner.switchCity(cityData.name)
		const [currentStamina, maxStamina] = ns.bladeburner.getStamina()
		const rank = ns.bladeburner.getRank()
		const health = ns.getPlayer().hp
		const blackOps = ns.bladeburner.getNextBlackOp()
		const blackOpsChance = ns.bladeburner.getActionEstimatedSuccessChance(ACTION_TYPES.blackops, blackOps.name)[0]
		const bestOperation = getBestOperation(ns)
		const bestContract = getBestContract(ns)
		
		upgradeSkills(ns)
		ns.bladeburner.joinBladeburnerFaction()
		ns.print(`Need analysis is ${needAnalysis}`)
		ns.print(`Need violence is ${needViolence}`)
		
		let actionType;
		let actionName;
		//Need to analyse
		if (needAnalysis) {
			actionType = ACTION_TYPES.action
			actionName = ACTIONS.analysis
			ns.print(`${cityData.name} success chance is inaccurate, action chosen is ${actionName}`)
		}
		//Need to recover
		else if (currentStamina <= maxStamina / 2 || health.current <= health.max / 2) {
			actionType = ACTION_TYPES.action
			actionName = ACTIONS.regen
			ns.print(`Players stamina or health are too low, action chosen is ${actionName}`)
		}
		//Need to reduce chaos
		else if (cityData.chaos >= MAX_CITY_CHAOS) {
			actionType = ACTION_TYPES.action
			actionName = ACTIONS.diplomacy
			ns.print(`City chaos is too high, action chosen is ${actionName}`)
		}
		//Can do black ops
		else if (blackOps !== null && rank >= blackOps.rank && blackOpsChance >= MIN_BLACKOPS_SUCCESS_CHANCE) {
			actionType = ACTION_TYPES.blackops
			actionName = blackOps.name
			ns.print(`Black Ops conditions satisfied, Black Ops name is ${actionName}`)
		}
		//City population is too low
		else if (cityData.population < MIN_CITY_POP) {
			ns.bladeburner.switchCity(CITIES[Math.floor(Math.random * CITIES.length)])
			actionType = ACTION_TYPES.action
			actionName = ACTIONS.analysis
			ns.print(`City population is too low, analysing a random city`)
		}
		//Ran out of operations or contracts
		else if (needViolence) {
			actionType = ACTION_TYPES.action
			actionName = ACTIONS.incite
			ns.print(`Ran out of operations and contracts, action chosen is ${actionName}`)
		}
		//Can do operation
		else if (bestOperation !== undefined) {
			actionType = bestOperation.type
			actionName = bestOperation.name
			ns.print(`Operation conditions satisfied, operation chosen is ${actionName}`)
		}
		//Can do contract
		else if (bestContract !== undefined) {
			actionType = bestContract.type
			actionName = bestContract.name
			ns.print(`Contract conditions satisfied, contract chosen is ${actionName}`)
		}
		//Can't do anything
		else {
			actionType = ACTION_TYPES.action
			actionName = ACTIONS.training
			ns.print(`No specific condition satisfied, action chosen is ${actionName}`)
		}

		ns.bladeburner.startAction(actionType, actionName)
		const sleepTime = calculateSleepTime(ns)
		ns.print(`Waiting for ${formatTime(sleepTime)} for the action to complete...`)
		report(ns)
		await ns.sleep(sleepTime + 200)
	}
}

/** 
 * @param {NS} ns 
 * @param {CityName} city
 * @return {{name: string, chaos: number, communities: number, population: number}}
 */
function loadCityData(ns, city) {
	const chaos = ns.bladeburner.getCityChaos(city)
	const communities = ns.bladeburner.getCityCommunities(city)
	const population = ns.bladeburner.getCityEstimatedPopulation(city)
	return {name: city, chaos: chaos, communities: communities, population: population}
}

/** 
 * @param {NS} ns 
 * @return {{name: string, chaos: number, communities: number, population: number}}
 */
function getBestCityData(ns) {
	const citiesData = []
	for (const city of CITIES)
		citiesData.push(loadCityData(ns, city))
	return citiesData.reduce((best, current) => (best.population > current.population) ? best : current, citiesData[0])
}

/** @param {NS} ns */
function upgradeSkills(ns) {
	const skillNames = ns.bladeburner.getSkillNames()
	const badSkills = ['Hands Of Midas', 'Cybers Edge']
	/** @type {{name: string, level: number, cost: number}[]} */
	const skillsData = []
	for (const skill of skillNames)
		if (!badSkills.includes(skill))
			skillsData.push(loadSkillData(ns, skill))
	//Prioritize lowest cost first, lowest level second
	// @ignore-infinite
	while (true) {
		skillsData
			.sort((skill1, skill2) => skill2.level - skill1.level)
			.sort((skill1, skill2) => skill2.cost - skill1.cost)
		const cheapestSkill = skillsData.pop()
		if (!ns.bladeburner.upgradeSkill(cheapestSkill.name)) return
		ns.print(`Upgraded skill ${cheapestSkill.name} to level ${cheapestSkill.level+1} using ${cheapestSkill.cost} skill points`)
		skillsData.push(loadSkillData(ns, cheapestSkill.name))
	}
}

/**
 * @param {NS} ns
 * @param {BladeburnerSkillName} skillName
 * @return {{name: string, level: number, cost: number}}
 */
function loadSkillData(ns, skillName) {
	const skillLevel = ns.bladeburner.getSkillLevel(skillName)
	const pointCost = ns.bladeburner.getSkillUpgradeCost(skillName)
	return {name: skillName, level: skillLevel, cost: pointCost}
}

/** 
 * @param {NS} ns 
 * @return {{type: BladeburnerActionType,name: BladeburnerActionName, minChance: number, maxChance: number, repGain: number, remaining: number}}
 */
function getBestOperation(ns) {
	const operationNames = ns.bladeburner.getOperationNames()
	const operationsData = []
	let assassinationData;
	for (const operation of operationNames) {
		const data = loadActionData(ns, ACTION_TYPES.operation, operation)
		if (data.name === OPERATIONS.assassinate)
			assassinationData = data
		operationsData.push(data)
	}
	//Assassination priority 1
	if (assassinationData.remaining > 0 && assassinationData.minChance >= MIN_OPERATION_SUCCESS_CHANCE)
		return assassinationData
	//Remove operations with low success chance
	const doableOperations = operationsData.filter(operation => operation.remaining > 0 && operation.minChance >= MIN_OPERATION_SUCCESS_CHANCE)
	//Get best expected rep
	doableOperations.sort((operation1, operation2) => operation2.minChance * operation2.repGain - operation1.minChance * operation1.repGain)
	//Remove raid if there are no communities
	if (doableOperations[0]?.name === OPERATIONS.raid && loadCityData(ns, ns.bladeburner.getCity()).communities < 1)
		doableOperations.shift()
	//Return best expected rep gain
	return doableOperations[0]
}

/** 
 * @param {NS} ns 
 * @return {{type: BladeburnerActionType,name: BladeburnerActionName, minChance: number, maxChance: number, repGain: number, remaining: number}}
 */
function getBestContract(ns) {
	const contractNames = ns.bladeburner.getContractNames()
	const contractsData = []
	for (const contract of contractNames)
		contractsData.push(loadActionData(ns, ACTION_TYPES.contract, contract))
	//Remove contracts wit low success chance
	const doableContracts = contractsData.filter(contract => contract.remaining > 0 && contract.minChance >= MIN_CONTRACT_SUCCESS_CHANCE)
	//Get best expected rep
	doableContracts.sort((contract1, contract2) => contract2.minChance * contract2.repGain - contract1.minChance * contract1.repGain)
	//Return best expected rep gain
	return doableContracts[0]
}

/** 
 * @param {NS} ns 
 * @param {BladeburnerActionName} operationName
 * @return {{type: BladeburnerActionType,name: BladeburnerActionName, minChance: number, maxChance: number, repGain: number, remaining: number}}
 */
function loadActionData(ns, actionType, actionName) {
	const [minChance, maxChance] = ns.bladeburner.getActionEstimatedSuccessChance(actionType, actionName)
	const repGain = ns.bladeburner.getActionRepGain(actionType, actionName)
	const remaining = ns.bladeburner.getActionCountRemaining(actionType, actionName)
	//Analysis check
	if (minChance / maxChance < MIN_SUCCESS_ACCURACY) needAnalysis = true
	//Violence check
	if (remaining < 1) needViolence = true
	return {type: actionType, name: actionName, minChance: minChance, maxChance: maxChance, repGain: repGain, remaining: remaining}
}

/** 
 * @param {NS} ns 
 * @return {number}
 */
function calculateSleepTime(ns) {
	const currentAction = ns.bladeburner.getCurrentAction()
	const totalTimeRequired = ns.bladeburner.getActionTime(currentAction.type, currentAction.name)
	const timePassed = ns.bladeburner.getActionCurrentTime()
	const bonusTime = ns.bladeburner.getBonusTime()
	let sleepTime = totalTimeRequired - timePassed
	if (bonusTime >= sleepTime) sleepTime /= 5
	return sleepTime
}

//--------------------------------------------------
//					<< GRAPHICS >>
//--------------------------------------------------
/** @param {NS} ns */
function report(ns) {
	//╔═╗╚╝║╠╣╟╢╤╧╪─│┬┴┼▲▼■□
	//Possible width 9.735 * characters

	//Header
	ns.print('╔════════════╤════════════╤═══════╤═══════╗')
	ns.print('║    City    │ Population │ Chaos │ Comm. ║')
	ns.print('╟────────────┼────────────┼───────┼───────╢')
	//ns.print('║ Chongqing  │    123.45k │  12.3 │  1234 ║');

	//Dynamic
	const currentCity = ns.bladeburner.getCity()
	for (const city of CITIES) {
		const cityData = loadCityData(ns, city)
		let formattedCity = cityData.name.padEnd(10, ' ')
		if (city === currentCity)
			formattedCity = '\x1B[33m' + formattedCity + '\x1B[0m'
		const formattedPopulation = ns.formatNumber(cityData.population, 2).padStart(10, ' ')
		const formattedChaos = ns.formatNumber(cityData.chaos, 1).padStart(5, ' ')
		const formattedCommunities = ns.formatNumber(cityData.communities, 0, 10e3).padStart(5, ' ')
		ns.print(`║ ${formattedCity} │ ${formattedPopulation} │ ${formattedChaos} │ ${formattedCommunities} ║`);
	}

	//Footer
	const currentAction = ns.bladeburner.getCurrentAction()
	const formattedAction = currentAction.name.padEnd(31, ' ')
	const formattedTimeRemaining = formatTime(calculateSleepTime(ns), true).padStart(5, ' ')

	const rank = ns.bladeburner.getRank()
	const formattedRank = ns.formatNumber(rank, (rank < 999995) ? 2 : 1).padStart(6, ' ')
	const [currentStamina, maxStamina] = ns.bladeburner.getStamina()
	const formattedStamina = ns.formatNumber(currentStamina, 1).padStart(5, ' ')
	const staminaPercent = currentStamina / maxStamina
	const formattedStaminaPercent = ns.formatPercent(staminaPercent, (staminaPercent < 0.9995) ? 1 : 0).padStart(5, ' ')

	const blackOps = ns.bladeburner.getNextBlackOp()
	const formattedBlackopsRank = ns.formatNumber(blackOps.rank, (blackOps.rank % 1e3 > 0) ? 1 : 0).padStart(6, ' ')
	const blackOpsChance = ns.bladeburner.getActionEstimatedSuccessChance(ACTION_TYPES.blackops, blackOps.name)[0]
	const formattedBlackopsChance = ns.formatPercent(blackOpsChance, (blackOpsChance < 0.9995) ? 1 : 0 ).padStart(5, ' ')

	ns.print('╠════════════╧════════════╧═══════╪═══════╣')
	ns.print(`║ ${formattedAction} │ ${formattedTimeRemaining} ║`)
	ns.print('╟──────┬────────┬─────────┬───────┼───────╢')
	ns.print(`║ Rank │ ${formattedRank} │ Stamina │ ${formattedStamina} │ ${formattedStaminaPercent} ║`)
	ns.print('╟──────┴────────┼────────┬┴───────┼───────╢')
	ns.print(`║ BlackOps rank │ ${formattedBlackopsRank} │ Chance │ ${formattedBlackopsChance} ║`)
	ns.print('╚═══════════════╧════════╧════════╧═══════╝')

	//Resize
	ns.resizeTail(419, 16 * 18)
	compactTail(ns.getScriptName())
}