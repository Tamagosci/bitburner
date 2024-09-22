/** @param {NS} ns */
export async function main(ns) {
	applyToAllCompanies(ns);
}

/** @type {{name: CompanyName, location: CityName}[]} */
const COMPANIES_WITH_FACTION = [
	//Volhaven
	{ name: 'NWO', location: 'Volhaven'},
	{ name: 'OmniTek Incorporated', location: 'Volhaven'},
	//Aevum
	{ name: 'Bachman & Associates', location: 'Aevum'},
	{ name: 'Fulcrum Technologies', location: 'Aevum'},
	{ name: 'Clarke Incorporated', location: 'Aevum'},
	{ name: 'ECorp', location: 'Aevum'},
	//Chongqing
	{ name: 'KuaiGong International', location: 'Chongqing'},
	//Sector-12
	{ name: 'Blade Industries', location: 'Sector-12'},
	{ name: 'MegaCorp', location: 'Sector-12'},
	{ name: 'Four Sigma', location: 'Sector-12'}
];

/** @type {JobField[]} */
const FIELD_PRIORITY = ['Security', 'Business', 'Software', 'IT']

/** @param {NS} ns */
export function applyToAllCompanies(ns) {
	const player = ns.getPlayer()
	const startingLocation = player.city
	for (const company of COMPANIES_WITH_FACTION) {
		ns.singularity.travelToCity(company.location)
		const currentJob = player.jobs[company.name]
		// Already have a job
		if (currentJob !== undefined) {
			const currnetJobDetails = ns.singularity.getCompanyPositionInfo(company.name, currentJob)
			// Job is not best available
			if (currnetJobDetails.field !== FIELD_PRIORITY[0]) {
				for (const field of FIELD_PRIORITY)
					if (ns.singularity.applyToCompany(company.name, field) || field === currnetJobDetails.field)
						break
			}
			// Job is already best kind available
			else {
				ns.singularity.applyToCompany(company.name, FIELD_PRIORITY[0])
			}
		}
		// Don't have a job yet
		else {
			for (const field of FIELD_PRIORITY)
				if (ns.singularity.applyToCompany(company.name, field))
					break
		}
	}
	ns.singularity.travelToCity(startingLocation)
}