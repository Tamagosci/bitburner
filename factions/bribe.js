/** @param {NS} ns */
export async function main(ns) {
	bribe(ns);
}

/** @param {NS} ns */
export function bribe(ns) {
	if (!ns.corporation.hasCorporation()) return
	const repCostMultiplier = ns.getBitNodeMultipliers().AugmentationRepCost
	if (ns.corporation.getCorporation().funds < 1e18 * repCostMultiplier) return

	const player = ns.getPlayer()
	const ownedAugments = ns.singularity.getOwnedAugmentations(true);
	const factionsINeedRepFor = player.factions.filter(faction =>
		ns.singularity.getAugmentationsFromFaction(faction).some(augment => !ownedAugments.includes(augment)) &&
		ns.singularity.getFactionRep(faction) < 2.5e6 * repCostMultiplier && // 2.5e6 Highest Besides Stanek, 1e8 Stanek
		(!ns.gang.inGang() || faction !== ns.gang.getGangInformation().faction)
	);
	
	for (const faction of factionsINeedRepFor)
		if (ns.corporation.bribe(faction, 5e15 * repCostMultiplier))
			ns.tprint(`SUCCESS Bribed ${faction}`);
}