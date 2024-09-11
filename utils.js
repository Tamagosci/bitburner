/** @param {NS} ns */
export async function main(ns) {
	ns.tprint("All the knowledge of the plague in one place.");
}

/**
 * @param {any[]} list
 * @return {any[]}
 */
export function removeDuplicates(list) {
	const result = [];
	list.forEach(element => { if (!result.includes(element)) result.push(element) });
	return result;
}

/**
 * @param {number} num
 * @return {number}
 */
export function formatNumberCustom(num, decimals = 1, compact = false) {
	if (num >= 1e33 || num <= -1e33) {
		let exponent = Math.floor(Math.log10(num));
		if (exponent > 99) return 'A LOT';
		if (compact === false) exponent -= exponent % 3;
		return `${(num / 10 ** exponent).toFixed(decimals)}e${exponent}`;
	}
	if (num >= 1e30 || num <= -1e30) { return (num / 1e30).toFixed(decimals) + "n"; }
	if (num >= 1e27 || num <= -1e27) { return (num / 1e27).toFixed(decimals) + "o"; }
	if (num >= 1e24 || num <= -1e24) { return (num / 1e24).toFixed(decimals) + "S"; }
	if (num >= 1e21 || num <= -1e21) { return (num / 1e21).toFixed(decimals) + "s"; }
	if (num >= 1e18 || num <= -1e18) { return (num / 1e18).toFixed(decimals) + "Q"; }
	if (num >= 1e15 || num <= -1e15) { return (num / 1e15).toFixed(decimals) + "q"; }
	if (num >= 1e12 || num <= -1e12) { return (num / 1e12).toFixed(decimals) + "t"; }
	if (num >= 1e9 || num <= -1e9) { return (num / 1e9).toFixed(decimals) + "b"; }
	if (num >= 1e6 || num <= -1e6) { return (num / 1e6).toFixed(decimals) + "m"; }
	if (num >= 1e3 || num <= -1e3) { return (num / 1e3).toFixed(decimals) + "k"; }
	return num.toFixed(decimals);
}


/**
 * @param {NS} ns
 * @param {boolean} includeHome
 * @return {string[]}
 */
export function getServerList(ns, includeHome = false, includeHacknet = false) {
	const allServers = ["home"];
	for (const server of allServers) {
		ns.scan(server).forEach((found) => { 
			if (allServers.includes(found) === false && (found.includes('hacknet') === false || includeHacknet)) allServers.push(found) 
		});
	}
	if (includeHome)
		return allServers;
	else
		return allServers.slice(1);
}

/**
 * @param {number} ms
 * @return {string}
 */
export function formatTime(ms, compact = false) {
	//Flags
	let shouldIncludeHours, shouldIncludeMinutes, shouldIncludeSeconds = false;
	//Formatted time
	let time = '';

	///Checks
	//Seconds check
	if (ms >= 1e3) shouldIncludeSeconds = true;
	//Minutes check
	if (ms >= 60e3) shouldIncludeMinutes = true;
	//Hours check
	if (ms >= 3.6e6) shouldIncludeHours = true;

	///Handling
	//Hours
	if (shouldIncludeHours) {
		time = time.concat(Math.floor(ms / 3.6e6) + 'h');
		ms %= 3.6e6;
	}
	//Minutes
	if (shouldIncludeMinutes) {
		ms = Math.ceil(ms / 1e3) * 1e3; //This is to fix xxm60s
		const minutes = Math.floor(ms / 60e3);
		if (shouldIncludeHours && minutes < 10)
			time = time.concat('0');
		time = time.concat(minutes + 'm');
		ms %= 60e3;
	}
	//Seconds
	if (shouldIncludeSeconds) {
		const seconds = Math.ceil(ms / 1e3);

		if (shouldIncludeMinutes)
			time = time.concat(seconds.toString().padStart(2, '0') + 's');
		else if (compact)
			time = time.concat(seconds + 's');
		else
			time = time.concat(seconds + ' seconds');
	}
	//Milliseconds
	else
		time = time.concat(Math.ceil(ms) + 'ms');

	//Finish
	return time;
}

/**
 * @return {{}}
 */
export function getServerSymbols() {
	return {
		'ECP': 'ecorp', 'ecorp': 'ECP',
		'MGCP': 'megacorp', 'megacorp': 'MGCP',
		'BLD': 'blade', 'blade': 'BLD',
		'CLRK': 'clarkinc', 'clarkinc': 'CLRK',
		'OMTK': 'omnitek', 'omnitek': 'OMTK',
		'FSIG': '4sigma', '4sigma': 'FSIG',
		'KGI': 'kuai-gong', 'kuai-gong': 'KGI',
		'FLCM': 'fulcrumtech', 'fulcrumtech': 'FLCM',
		'STM': 'stormtech', 'stormtech': 'STM',
		'DCOMM': 'defcomm', 'defcomm': 'DCOMM',
		'HLS': 'helios', 'helios': 'HLS',
		'VITA': 'vitalife', 'vitalife': 'VITA',
		'ICRS': 'icarus', 'icarus': 'ICRS',
		'UNV': 'univ-energy', 'univ-energy': 'UNV',
		'AERO': 'aerocorp', 'aerocorp': 'AERO',
		'OMN': 'omnia', 'omnia': 'OMN',
		'SLRS': 'solaris', 'solaris': 'SLRS',
		'GPH': 'global-pharm', 'global-pharm': 'GPH',
		'NVMD': 'nova-med', 'nova-med': 'NVMD',
		'WDS': undefined,
		'LXO': 'lexo-corp', 'lexo-corp': 'LXO',
		'RHOC': 'rho-construction', 'rho-construction': 'RHOC',
		'APHE': 'alpha-ent', 'alpha-ent': 'APHE',
		'SYSC': 'syscore', 'syscore': 'SYSC',
		'CTK': 'computek', 'computek': 'CTK',
		'NTLK': 'netlink', 'netlink': 'NTLK',
		'OMGA': 'omega-net', 'omega-net': 'OMGA',
		'FNS': 'foodnstuff', 'foodnstuff': 'FNS',
		'SGC': 'sigma-cosmetics', 'sigma-cosmetics': 'SGC',
		'JGN': 'joesguns', 'joesguns': 'JGN',
		'CTYS': 'catalyst', 'catalyst': 'CTYS',
		'MDYN': 'microdyne', 'microdyne': 'MDYN',
		'TITN': 'titan-labs', 'titan-labs': 'TITN'
	};
}

export function getCities() {
	return [
		'Aevum', 'Chongqing', 'Sector-12', 'New Tokyo', 'Ishima', 'Volhaven'
	];
}

export function compactAllTails() {
	//const document = eval('document');
	const resizables = eval('document').querySelectorAll('div.react-resizable');
	const tails = [];
	for (const resizable of resizables)
		tails.push(resizable.children[1].children[0]);
	for (const tail of tails) {
		for (const line of tail.children) {
			line.style.lineHeight = 1;
		}
	}
}

/** @param {string} script */
export function compactTail(script) {
	//const document = eval('document');
	const resizables = eval('document').querySelectorAll('div.react-resizable');
	const tailBox = Array.from(resizables).find(box => box.children[0].children[0].title.match(script));
	if (tailBox === undefined) return;
	for (const line of tailBox.children[1].children[0].children) {
		line.style.lineHeight = 1;
	}
}

export const colors = {
	std: '\x1B[0m',
	bold: '\x1B[2m',
	black: '\x1B[30m',
	red: '\x1B[31m',
	green: '\x1B[32m',
	yellow: '\x1B[33m',
	blue: '\x1B[34m',
	magenta: '\x1B[35m',
	cyan: '\x1B[36m',
	white: '\x1B[37m'
}