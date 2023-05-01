export class HGWBatch {
	/**
	 * @param {NS} ns
	 * @param {string} target
	 * @param {number} percentToHack
	 * @param {number} batchSpacer
	 * @return {HGWBatch}
	 */
	constructor(ns, target, percentToHack, batchSpacer, servers = ['home']) {
		//Initialize variable
		this.target = target;
		this.percentToHack = percentToHack;
		this.batchSpacer = batchSpacer;
		this.actionSpacer = Math.floor(batchSpacer / 3); //Favors multiples of 3
		this.host = ns.getHostname();
		this.servers = servers;
		//Initialize primed server copy
		this.primed = ns.getServer(target);
		this.primed.hackDifficulty = this.primed.minDifficulty;
		this.primed.moneyAvailable = this.primed.moneyMax;
		//Everything else
		this.update(ns);
	}

	/** @param {NS} ns */
	update(ns, servers = this.servers) {
		//Update server list
		this.servers = servers;
		//Re-calculate times
		this.hackTime = getHackTime(ns, this.primed);
		this.growTime = getGrowTime(ns, this.primed);
		this.weakenTime = getWeakenTime(ns, this.primed);
		this.batchTime = this.weakenTime + this.actionSpacer;
		//Re-calculate thread counts
		const threads = this.getHGWBatchThreads(ns);
		this.hackThreads = threads.hack;
		this.growThreads = threads.grow;
		this.weakenThreads = threads.weaken;
		//Calculate delays
		this.hackDelay = this.weakenTime - this.actionSpacer * 2 - this.hackTime; //spacer * 2 < weakenTime - hacktime
		this.growDelay = this.weakenTime - this.actionSpacer - this.growTime;
		this.weakenDelay = 0;
		//Calculate ends
		this.weakenEnd = this.weakenTime;
		this.growEnd = this.weakenTime - this.actionSpacer;
		this.hackEnd = this.weakenTime - this.actionSpacer * 2;
		//Calculate ram costs
		this.batchCost = (threads.hack + threads.grow + threads.weaken) * 1.75;
		//Calculate concurrent batches
		const availableRam = servers.reduce((total, host) => total + ns.getServerMaxRam(host) - ns.getServerUsedRam(host), 0);
		this.concurrentBatches = Math.floor(availableRam / this.batchCost);
		//Calculate times
		this.earningTime = this.concurrentBatches * this.batchSpacer;
		this.deadTime = this.hackEnd;
		this.batchTime = this.deadTime + this.earningTime;
		//Calculate income
		this.income = this.getServerIncome(ns);
		this.batchIncome = this.income * this.batchTime / 1000;
	}

	/**
	 * @param {NS} ns
	 * @return {number}
	 */
	getHGWBatchThreads(ns) {
		return (ns.fileExists('formulas.exe', 'home'))
			? this.getHGWBatchThreadsFormulas(ns)
			: this.getHGWBatchThreadsNoFormulas(ns);
	}

	/**
	 * @param {NS} ns
	 * @return {number}
	 */
	getHGWBatchThreadsFormulas(ns) {
		//Static target parameters
		const server = this.primed;
		const player = ns.getPlayer();
		//Calculate thread counts
		const hackPercent = ns.formulas.hacking.hackPercent(server, player);
		const hackThreads = (this.percentToHack / hackPercent > 1)
			? Math.floor(this.percentToHack / hackPercent)
			: 1;
		const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackThreads);
		server.hackDifficulty += hackSecurityIncrease;
		server.moneyAvailable = (hackPercent <= 1)
			? Math.floor(server.moneyMax * (1 - hackPercent * hackThreads))
			: 0;
		const growthThreads = Math.ceil(ns.formulas.hacking.growThreads(server, player, server.moneyMax));
		const growthSecurityIncrease = ns.growthAnalyzeSecurity(growthThreads);
		const weakenThreads = Math.ceil((growthSecurityIncrease + hackSecurityIncrease) / ns.weakenAnalyze(1));

		return { hack: hackThreads, grow: growthThreads, weaken: weakenThreads };
	}

	/**
	 * @param {NS} ns
	 * @return {number}
	 */
	getHGWBatchThreadsNoFormulas(ns) {
		//Static host parameters
		if (this.percentToHack > 0.8) this.percentToHack = 0.8;
		const divider = 1 / (1 - this.percentToHack);
		const cushion = 1.05;
		//Static target parameters
		const maxMoney = ns.getServerMaxMoney(this.target);
		//Dynamic target parameters
		const growthMultiplier = divider * cushion;
		//Calculate thread counts
		const hackAnalyze = ns.hackAnalyzeThreads(this.target, Math.floor(maxMoney / divider))
		const hackThreads = (hackAnalyze >= 1)
			? Math.floor(hackAnalyze)
			: 1;
		const growthThreads = Math.ceil(ns.growthAnalyze(this.target, growthMultiplier)); //Cores are included automatically i think
		const weakenThreads = Math.ceil((growthThreads * ns.growthAnalyzeSecurity(1) + hackThreads * 0.002) / ns.weakenAnalyze(1));

		return { hack: hackThreads, grow: growthThreads, weaken: weakenThreads };
	}

	/**
	 * @param {NS} ns
	 * @return {number}
	 */
	getServerIncome(ns) {
		return (ns.fileExists('formulas.exe', 'home'))
			? this.getServerIncomeFormulas(ns)
			: this.getServerIncomeNoFormulas(ns);
	}

	/**
	 * @param {NS} ns
	 * @return {number}
	 */
	getServerIncomeFormulas(ns) {
		return this.primed.moneyMax
			* this.percentToHack
			* (1000 / this.batchSpacer)
			* ns.formulas.hacking.hackChance(this.primed, ns.getPlayer())
			* (this.earningTime / this.batchTime);
	}

	/**
	 * @param {NS} ns
	 * @return {number}
	 */
	getServerIncomeNoFormulas(ns) {
		return ns.getServerMaxMoney(this.target)
			* this.percentToHack
			* (1000 / this.batchSpacer)
			* ns.hackAnalyzeChance(this.target)
			* (this.earningTime / this.batchTime);
	}

	/** 
	 * @param {number} now
	 * @return {{}}
	 */
	getSafeWindow(now) {
		return { start: this.weakenEnd + now, end: this.weakenEnd - this.actionSpacer + now };
	}
}

/**
 * @param {NS} ns
 * @param {Server} server
 * @return {number}
 */
export function getWeakenTime(ns, server) {
	if (ns.fileExists('formulas.exe', 'home'))
		return ns.formulas.hacking.weakenTime(server, ns.getPlayer());
	else
		return ns.getWeakenTime(server.hostname);
}

/**
 * @param {NS} ns
 * @param {Server} server
 * @return {number}
 */
export function getHackTime(ns, server) {
	if (ns.fileExists('formulas.exe', 'home'))
		return ns.formulas.hacking.hackTime(server, ns.getPlayer());
	else
		return ns.getHackTime(server.hostname);
}

/**
 * @param {NS} ns
 * @param {Server} server
 * @return {number}
 */
export function getGrowTime(ns, server) {
	if (ns.fileExists('formulas.exe', 'home'))
		return ns.formulas.hacking.growTime(server, ns.getPlayer());
	else
		return ns.getGrowTime(server.hostname);
}