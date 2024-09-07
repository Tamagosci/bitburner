/** @param {NS} ns */
export async function main(ns) {
	applyToAllCompanies(ns);
}

const COMPANY_JOBS = [
	//Volhaven
	{ company: 'NWO', location: 'Volhaven', role: 'IT'},
	{ company: 'OmniTek Incorporated', location: 'Volhaven', role: 'IT'},
	//Aevum
	{ company: 'Bachman & Associates', location: 'Aevum', role: 'IT'},
	{ company: 'Fulcrum Technologies', location: 'Aevum', role: 'IT'},
	{ company: 'Clarke Incorporated', location: 'Aevum', role: 'IT'},
	{ company: 'ECorp', location: 'Aevum', role: 'IT'},
	//Chongqing
	{ company: 'KuaiGong International', location: 'Chongqing', role: 'IT'},
	//Sector-12
	{ company: 'Blade Industries', location: 'Sector-12', role: 'IT' },
	{ company: 'MegaCorp', location: 'Sector-12', role: 'IT'},
	{ company: 'Four Sigma', location: 'Sector-12', role: 'IT'}
];

/** @param {NS} ns */
export function applyToAllCompanies(ns) {
	const startingLocation = ns.getPlayer().city;
	for (const job of COMPANY_JOBS) {
		ns.singularity.travelToCity(job.location);
		ns.singularity.applyToCompany(job.company, job.role);
		//ns.tprint(`ERROR Failed to apply to ${job.company} as ${job.role}`)
	}
	ns.singularity.travelToCity(startingLocation);
}