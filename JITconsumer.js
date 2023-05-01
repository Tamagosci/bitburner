/** @param {NS} ns */
export async function main(ns) {
	//WIP
}

/**
 * @param {NS} ns
 * @param {HGWBatch} batch
 */
export async function consumeJIT(ns, batch) {
	//Calculate availabe ram
	HOST = ns.getHostname();
	MAX_RAM = ns.getServerMaxRam(HOST);

	let safeWindows = [];
	safeWindows.push({ start: NOW(), end: batch.hackDelay });

	while (true) {
		//Wait for ram
		while (batch.batchCost > MAX_RAM - ns.getServerUsedRam(HOST))
			await ns.sleep(batch.actionSpacer);
		//Update timings
		batch.update(ns);
		safeWindows = removeOldWindows(safeWindows);
		//Run batch
		await safeWindows.push(runBatchJIT(ns, batch, safeWindows, !isPrimed(ns, batch.target)));
	}
}

/**
 * @param {NS} ns
 * @param {HGWBatch} batch
 * @param {{}} safeWindows
 * @param {boolean} fixCollision
 * @return {{}} safeWindow
 */
async function runBatchJIT(ns, batch, safeWindows, fixCollision) {	
	//Wait for safe windows
	const now = NOW();
	if (safeWindows.length > 0)
		while (!fallsInAnyWindow(now, safeWindows)
			&& !fallsInAnyWindow(now + batch.growDelay, safeWindows)
			&& (fixCollision || !fallsInAnyWindow(now + batch.hackDelay, safeWindows)))
			await ns.sleep(batch.actionSpacer);
	//Run HGW
	if (!fixCollision)
		ns.run('hack.js', batch.hackThreads, batch.target, batch.hackDelay, now);
	ns.run('grow.js', batch.growThreads, batch.target, batch.growDelay, now);
	ns.run('weaken.js', batch.weakenThreads, batch.target, batch.weakenDelay, now);
	return batch.getSafeWindow(NOW());
}

/**
 * @param {number} time
 * @param {{}} windows
 * @return {boolean}
 */
function fallsInAnyWindow(time, windows) {
	return windows.some(window => time > window.start && time < window.end);
}

/**
 * @param {{}} windows
 * @return {{}} windows
 */
function removeOldWindows(windows) {
	const stillGood = [];
	for (let window of windows)
		if (window.end > NOW())
			stillGood.push(window);
	return stillGood;
}