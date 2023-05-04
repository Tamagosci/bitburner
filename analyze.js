import { formatMoney, formatTime } from 'utils.js';
import { openPorts } from 'infect.js';

/** @param {NS} ns */
export async function main(ns) {
	const [target] = ns.args;
	await analyze(ns, target);
}

/**
 * @param {NS} ns
 * @param {string} target
 */
async function analyze(ns, target) {
	//Safety
	if (!ns.serverExists(target)) {
		ns.tprintf('ERROR Server %s does not exist.', target);
		return;
	}
	//Logging
	ns.disableLog('ALL');
	ns.clearLog();
	ns.tail();
	await ns.sleep(0);
	ns.moveTail(1297, 258);

	//Data
	const server = ns.getServer(target);
	const player = ns.getPlayer();
	const lineCount = (server.purchasedByPlayer) ? 14 : 13;
	ns.resizeTail(300, 32 + 24 * lineCount);

	//Print
	ns.print(`<<${server.hostname}>>`.padStart(Math.ceil((30 - server.hostname.length - 4) / 2 + server.hostname.length + 4), ' ').padEnd(30, ' '));
	ns.print(`IP Address:      ${server.ip}`);
	ns.print(`Has Root:        ${server.hasAdminRights.toString().padStart(5, ' ')}`);
	ns.print(`Backdoor:        ${server.backdoorInstalled.toString().padStart(5, ' ')}`);
	ns.print(`Required Level:  ${ns.getHackingLevel().toString().padStart(5, ' ')} / ${server.requiredHackingSkill}`);
	ns.print(`Open Ports:      ${openPorts(ns, target).toString().padStart(5, ' ')} / ${server.numOpenPortsRequired}`);
	ns.print(`Security:        ${server.hackDifficulty.toFixed(0).padStart(5, ' ')} / ${server.minDifficulty}`);
	ns.print(`Money:           ${('$' + formatMoney(server.moneyAvailable, 0)).padStart(5, ' ')} / ${('$' + formatMoney(server.moneyMax, 0))}`);
	ns.print(`Used Ram:        ${ns.formatRam(server.ramUsed, 0).padStart(5, ' ')} / ${ns.formatRam(server.maxRam, 0)}`);
	if (server.purchasedByPlayer)
	ns.print(`Max Ram:         ${ns.formatRam(server.maxRam, 0).padStart(5, ' ')} / ${ns.formatRam(ns.getPurchasedServerMaxRam(), 0)}`)
	ns.print(`Grow Threads:    ${ns.formulas.hacking.growThreads(server, player, server.moneyMax).toString().padStart(5, ' ')}`);
	ns.print(`Weaken Threads:  ${Math.ceil((server.hackDifficulty - server.minDifficulty) / ns.weakenAnalyze(1)).toString().padStart(5, ' ')}`);
	ns.print(`Weaken Time:     ${formatTime(ns.getWeakenTime(server.hostname)).padStart(5, ' ')}`);
}