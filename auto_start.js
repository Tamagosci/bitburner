// Which file to run if home ram is >= specified ram
// First come first serve
const SCRIPTS = [
	{ file: 'gang/auto_gang.js', ram: 512 },
	{ file: 'contracts/auto_solve.js', ram: 256 },
	{ file: 'sleeves/auto_assign.js', ram: 512 },
	{ file: 'hacking/JIT.js', ram: 64 },
	{ file: 'upgrades/augments.js', ram: 512},
	{ file: 'ipvgo/sphyxis.js', ram: 256 },
	{ file: 'hacknet/hashnet.js', ram: 256 },
	{ file: 'stocks/stocks.js', ram: 256 }
	//{ file: 'hacking/shotgun_v4.js', ram: 32 } //Alternative to auto should it break
];

const HOME = 'home';

/** @param {NS} ns */
export async function main(ns) {
	//This is supposed to be ran exclusively from home
	if (ns.getHostname() !== HOME) return;
	const ram = ns.getServerMaxRam(HOME);
	const player = ns.getPlayer();

	//Kill everything
	//ns.run('killall.js');
	
	ns.run('servers/infect_all.js');
	await ns.sleep(100);

	//Start of bitnode logic to get stanek's gift
	if (player.karma === 0)
		ns.run('stanek/auto_charge.js', 1, 1);

	//Run scripts if conditions allow
	for (const script of SCRIPTS) {
		if (!ns.isRunning(script.file) && ram >= script.ram)
			ns.run(script.file)
		await ns.sleep(100);
	}

	// Corporation
	const corpoScript = 'corporation/auto_corp.js';
	if (ns.corporation.hasCorporation() && !ns.isRunning(corpoScript)) ns.run(corpoScript);

	// Bladeburner
	const bladeburnerScript = 'bladeburner/auto_bb.js';
	if (ns.bladeburner.inBladeburner() && !ns.isRunning(bladeburnerScript)) ns.run(bladeburnerScript);

	if (player.skills.hacking < 50 && (!ns.bladeburner.inBladeburner() || ns.singularity.getOwnedAugmentations(false).includes("The Blade's Simulacrum")))
		ns.singularity.universityCourse('Rothman University', 'Algorithms', false);
	else
		ns.singularity.commitCrime('Mug', false);
	
	const stanekPid = ns.run('stanek/auto_charge.js', 1, Math.log2(ram) * 2);
	while (ns.isRunning(stanekPid)) await ns.sleep(1e3);
	
	ns.run('share.js', Math.max(4, Math.ceil(Math.sqrt(ram) / 4)));
}