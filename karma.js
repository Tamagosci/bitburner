import { formatTime } from 'utils.js';

const GANG_THRESHOLD = -54_000;

/** @param {NS} ns */
export async function main(ns) {
	let [testSeconds = 24] = ns.args;
	const startingKarma = ns.getPlayer().karma;
	const sleepTime = testSeconds * 1e3;
	ns.tprint(`Karma: ${startingKarma.toFixed(2)} / ${GANG_THRESHOLD}`);
	if (startingKarma <= GANG_THRESHOLD) return;
	await ns.sleep(sleepTime);
	const endingKarma = ns.getPlayer().karma;
	const avgKarmaPerMS = (endingKarma - startingKarma) / sleepTime;
	const sleeveShock = ns.sleeve.getSleeve(0).shock;
	let expectedTimeMS = (GANG_THRESHOLD - endingKarma) / avgKarmaPerMS;
	if (sleeveShock > 50) expectedTimeMS /= 4;
	else if (sleeveShock > 25) expectedTimeMS /= 2;
	ns.tprint(`Time until gang with current pace: ${formatTime(expectedTimeMS)}`);
}