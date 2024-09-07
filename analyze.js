import { formatTime, getServerList } from 'utils.js';
import { openPorts } from 'servers/infect.js';

/** @param {NS} ns */
export async function main(ns) {
	const [target, loop = false] = ns.args;
	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(0);
	ns.moveTail(1657, 384);
	//Analyze
	analyze(ns, target);
	while (loop) {
		await ns.sleep(1e3 * Math.random());
		analyze(ns, target);
	}
}

/**
 * @param {NS} ns
 * @param {string} target
 */
function analyze(ns, target) {
	//Data
	target = getServerList(ns, true, true).find(server => server.toLowerCase().search(target.toLowerCase()) != -1);
	if (target === undefined) {
		ns.closeTail();
		ns.tprint('ERROR Invalid server name!');
		return;
	}
	const server = ns.getServer(target);
	const player = ns.getPlayer();
	const isHacknet = server.hostname.includes('hacknet');
	let lineCount = 14;
	if (isHacknet) lineCount -= 3;

	ns.resizeTail(300, 32 + 24 * lineCount);

	const maxRam = (server.purchasedByPlayer)
		? (isHacknet)
			? ns.formatRam(64, 0)
			: ns.formatRam(ns.getPurchasedServerMaxRam(), 0)
		: ns.formatRam(server.maxRam, 0);

	//Print
	ns.print('\n'); //Empty line
	ns.print(`<<${server.hostname}>>`.padStart(Math.ceil((30 - server.hostname.length - 4) / 2 + server.hostname.length + 4), ' ').padEnd(30, ' '));
	ns.print(`IP Address:      ${server.ip}`);
	ns.print(`Has Root:        ${server.hasAdminRights.toString().padStart(5, ' ')}`);
	ns.print(`Backdoor:        ${server.backdoorInstalled?.toString().padStart(5, ' ')}`);
	ns.print(`Required Level:  ${ns.getHackingLevel()?.toString().padStart(5, ' ')} / ${server.requiredHackingSkill}`);
	ns.print(`Open Ports:      ${openPorts(ns, target).toString().padStart(5, ' ')} / ${server.numOpenPortsRequired}`);
	ns.print(`Security:        ${server.hackDifficulty.toFixed(1).padStart(5, ' ')} / ${server.minDifficulty.toFixed(1)}`);
	ns.print(`Money:           ${('$' + ns.formatNumber(server.moneyAvailable, 0)).padStart(5, ' ')} / ${('$' + ns.formatNumber(server.moneyMax, 0))}`);
	ns.print(`Used Ram:        ${ns.formatRam(server.ramUsed, 0).padStart(5, ' ')} / ${ns.formatRam(server.maxRam, 0)}`);
	ns.print(`Max Ram:         ${ns.formatRam(server.maxRam, 0).padStart(5, ' ')} / ${maxRam}`)
	if (isHacknet === false) {
		ns.print(`Grow Threads:    ${ns.formulas.hacking.growThreads(server, player, server.moneyMax).toString().padStart(5, ' ')}`);
		ns.print(`Weaken Threads:  ${Math.ceil((server.hackDifficulty - server.minDifficulty) / ns.weakenAnalyze(1)).toString().padStart(5, ' ')}`);
		ns.print(`Weaken Time:     ${formatTime(ns.getWeakenTime(server.hostname)).padStart(5, ' ')}`);
	}
}