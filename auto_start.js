// Which file to run if home ram is >= specified ram
// First come first serve
const SCRIPTS = [
	{ file: 'corporation/auto_corp.js', ram: 2048 }, //File is currently WIP
	{ file: 'gang/auto_gang.js', ram: 512 },
	{ file: 'sleeves/auto_assign.js', ram: 512 },
	{ file: 'upgrades/augments.js', ram: 512},
	{ file: 'contracts/auto_solve.js', ram: 256 },
	{ file: 'ipvgo/sphyxis.js', ram: 256 },
	{ file: 'stocks/stocks.js', ram: 256 },
	{ file: 'hacknet/hashnet.js', ram: 256 },
	{ file: 'hacking/JIT_v4.js', ram: 32 }
	//{ file: 'hacking/shotgun_v4.js', ram: 32 } //Alternative to auto should it break
];

const HOME = 'home';

/** @param {NS} ns */
export async function main(ns) {
	//This is supposed to be ran exclusively from home
	if (ns.getHostname() !== HOME) return;
	const ram = ns.getServerMaxRam(HOME);

	//Kill everything
	//ns.run('killall.js');
	
	ns.run('servers/infect_all.js');
	await ns.sleep(100);

	ns.singularity.commitCrime('Mug', false);
	const stanekPid = ns.run('stanek/auto_charge.js', 1, Math.log2(ram) * 2);
	await ns.sleep(1e3); //Wait until script travelled to the church
	ns.singularity.universityCourse('Rothman University', 'Algorithms', false);
	while (ns.isRunning(stanekPid)) await ns.sleep(7e3);

	//Run scripts if conditions allow
	for (const script of SCRIPTS) {
		if (ram >= script.ram) ns.run(script.file);
		await ns.sleep(100);
	}
	
	ns.run('share.js', Math.max(4, Math.ceil(Math.sqrt(ram) / 4)));
}