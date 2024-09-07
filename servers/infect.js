/** @param {NS} ns */
//Infect a new host
export async function main(ns) {
	//Check if hostname is present
	if (ns.args.length === 0) {
		ns.tprint("ERROR Target hostname expected as argument.");
		ns.exit();
	}
	
	infect(ns, ns.args[0]);
}

/**
 * @param {NS} ns
 * @param {string} target
 */
export function infect(ns, target) {
	//Open ports
	const opened = openPorts(ns, target);
	//if (opened > 0)
		//ns.printf('Successfully opened %s ports on server %s.', opened, target);

	//Get control
	if (opened >= ns.getServerNumPortsRequired(target)) {
		//Nuke
		ns.nuke(target);

		//Backdoor
		//NOTE: Moved to separate script to keep ram usage low
	}
}

/**
 * @param {NS} ns
 * @param {string} target
 * @return {number} Number of ports opened
 */
export function openPorts(ns, target) {
	//Count open ports
	let opened = 0;
	//SSH
	if (ns.fileExists('BruteSSH.exe', 'home')) {
		ns.brutessh(target);
		opened++;
	}
	//FTP
	if (ns.fileExists('FTPCrack.exe', 'home')) {
		ns.ftpcrack(target);
		opened++;
	}
	//SMTP
	if (ns.fileExists('relaySMTP.exe', 'home')) {
		ns.relaysmtp(target);
		opened++;
	}
	//HTTP
	if (ns.fileExists('HTTPWorm.exe', 'home')) {
		ns.httpworm(target);
		opened++;
	}
	//SQL
	if (ns.fileExists('SQLInject.exe', 'home')) {
		ns.sqlinject(target);
		opened++;
	}
	return opened;
}