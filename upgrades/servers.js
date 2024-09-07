const BASE_NAME = 'Echo';
const MIN_RAM = 128;

let funds;

/** @param {NS} ns */
export async function main(ns) {
	if (ns.args[0] == '-r')
		await report(ns);
	else
		expandServers(ns);
}

/** @param {NS} ns */
export function expandServers(ns, percentOfMoneyToUse = 1) {
	funds = ns.getPlayer().money * percentOfMoneyToUse;
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
			currentRam *= 2;
			const cost = ns.getPurchasedServerUpgradeCost(server, currentRam);
			if (cost > funds) break;
			funds -= cost;
			ns.upgradePurchasedServer(server, currentRam);
			ns.print(`SUCCESS Upgraded ${server}'s ram to ${ns.formatRam(currentRam, 0)}!`);
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
	//Gather data
	const owned = ns.getPurchasedServers();
	const maxAmount = ns.getPurchasedServerLimit();
	const maxRamValue = ns.getPurchasedServerMaxRam();
	const maxRam = ns.formatRam(maxRamValue, 0);
	ns.resizeTail(337, 30 + 24 * (owned.length + 4));
	//Report
	ns.print('----------------------------------');
	ns.print(`     PURCHASED SERVERS  ${owned.length}/${maxAmount}`);
	ns.print('----------------------------------');
	for (const server of owned) {
		const ram = ns.getServerMaxRam(server);
		const maxed = (ram === maxRamValue) ? '[✓]' : '[X]';
		const paddedRam = ns.formatRam(ram, 0).padStart(5, ' ');
		const message = `<${server}>\t${paddedRam} / ${maxRam}  ${maxed}`;
		ns.print(message);
	}	
}