const BASE_NAME = 'Echo';
const MIN_RAM = 128;
const HOME = 'home';

let funds;

/** @param {NS} ns */
export async function main(ns) {
	if (ns.args[0] == '-r')
		await report(ns);
	else
		expand(ns);
}

/** @param {NS} ns */
export function expand(ns) {
	funds = ns.getServerMoneyAvailable(HOME);
	purchaseMore(ns);
	upgradeOwned(ns);
}

/** @param {NS} ns */
function purchaseMore(ns) {
	const maxAmount = ns.getPurchasedServerLimit();
	let ownedAmount = ns.getPurchasedServers().length;
	if (ownedAmount === maxAmount) return;
	const cost = ns.getPurchasedServerCost(MIN_RAM);
	while (cost < funds && ownedAmount < maxAmount) {
		const name = `${BASE_NAME}-${++ownedAmount}`;
		ns.purchaseServer(name, MIN_RAM);
		ns.print(`SUCCESS Purchased server ${name}!`);
		funds -= cost;
	}
}

/** @param {NS} ns */
function upgradeOwned(ns) {
	const owned = ns.getPurchasedServers();
	const maxRam = ns.getPurchasedServerMaxRam();
	for (const server of owned) {
		let currentRam = ns.getServerMaxRam(server);
		while (currentRam < maxRam) {
			const cost = ns.getPurchasedServerUpgradeCost(server, currentRam * 2);
			if (cost > funds) break;
			currentRam *= 2;
			funds -= cost;
			ns.upgradePurchasedServer(server, currentRam);
			ns.print(`SUCCESS Upgraded ${server}'s ram to ${currentRam}!`);
		}
	}
}

/** @param {NS} ns */
async function report(ns) {
	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(0);
	ns.resizeTail(312, 720);
	//Gather data
	const owned = ns.getPurchasedServers();
	const maxAmount = ns.getPurchasedServerLimit();
	const maxRam = ns.formatRam(ns.getPurchasedServerMaxRam(), 0);
	//Report
	ns.print('--------------------------------');
	ns.print(`    PURCHASED SERVERS  ${owned.length}/${maxAmount}`);
	ns.print('--------------------------------');
	for (const server of owned) {
		const ram = ns.getServerMaxRam(server);
		const maxed = (ram === maxRam) ? '[✓]' : '[X]';
		const paddedRam = ns.formatRam(ram, 0).padStart(5, ' ');
		const message = `<${server}>\t${paddedRam} / ${maxRam}  ${maxed}`;
		ns.print(message);
	}	
}