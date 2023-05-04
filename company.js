/** @param {NS} ns */
export async function main(ns) {
	applyToAll(ns);
}

const COMPANY_JOBS = [
	//Aevum
	{ company: 'Bachman & Associates', location: 'Aevum', role: 'Business'},
	{ company: 'Clarke Incorporated', location: 'Aevum', role: 'Business'},
	{ company: 'ECorp', location: 'Aevum', role: 'Business'},
	{ company: 'Fulcrum Technologies', location: 'Aevum', role: 'Business'},
	//Chongqing
	{ company: 'KuaiGong International', location: 'Chongqing', role: 'Business'},
	//Sector-12
	{ company: 'Blade Industries', location: 'Sector-12', role: 'Business' },
	{ company: 'MegaCorp', location: 'Sector-12', role: 'Business'},
	{ company: 'Four Sigma', location: 'Sector-12', role: 'Business'},
	//Volhaven
	{ company: 'OmniTek Incorporated', location: 'Volhaven', role: 'Business'},
	{ company: 'NWO', location: 'Volhaven', role: 'Business'}
];

/** @param {NS} ns */
function applyToAll(ns) {
	const startingLocation = ns.getPlayer().city;
	for (const job of COMPANY_JOBS) {
		ns.singularity.travelToCity(job.location);
		ns.singularity.applyToCompany(job.company, job.role);
	}
	ns.singularity.travelToCity(startingLocation);
}