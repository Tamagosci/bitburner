//https://github.com/danielyxie/bitburner/blob/4363aa43fecccd0daaf6613157fe474fef63b1a9/src/Exploits/Exploit.ts

const ALL_EXPLOITS = ['Bypass', 'PrototypeTampering', 'Unclickable', 
	'UndocumentedFunctionCall', 'TimeCompression', 'RealityAlteration', 
	'N00dles', 'YoureNotMeantToAccessThis', 'EditSaveFile'];
//Missing arcade exploit

/** @param {NS} ns */
export async function main(ns) {
	const [mode] = ns.args;
	try {
		switch (mode) {
			case 'unclickable':
				unclickable();
				return;
			case 'savefile':
				//await savefile('EditSaveFile');
				return;
			case 'reality':
				//Sorry couldn't find a way to do it without rebuilding the game in dev mode
				//You are supposed to use a breakpoint to change a value mid-function
				//ns.alterReality();
				//await savefile('RealityAlteration');
				return;
			case 'ram':
				eval('ns.bypass(document);');
				return;
			case 'numbers':
				Number.prototype.toExponential = function () { return null; };
				return;
			case 'time':
				eval('window').performance.now = function () { return 0; };
				return;
			case 'undocumented':
				ns.exploit();
				return;
			case 'rainbow':
				ns.rainbow('noodles');
				return;
			case 'dev':
				await devMenu(ns);
				return;
			default:
				ns.tprint('ERROR Wrong code');
				return;
		}
	}
	catch (exception) { ns.tprintf('ERROR -1: %s', exception.message); }
}

function unclickable() {
	eval('document').getElementById('unclickable').style = "display: block;position: absolute;top: 50%;left: 50%;width: 100px;height: 100px;z-index: 10000;background: red;";
	eval('document').getElementById('unclickable').parentNode.addEventListener('click', () => {
		eval('document').getElementById('unclickable').style = "display: none; visibility: hidden;";
	}, true);
}

async function savefile(exploit) {
	let saveStr = decodeURIComponent(escape(atob(await load())));
	// ns.print(saveStr);

	saveStr = saveStr.replace('\\"exploits\\":[', '\\"exploits\\":[\\"'+exploit+'\\",');

	saveStr = btoa(unescape(encodeURIComponent(saveStr)));
	await save(saveStr);
}

function getDB() {
	return new Promise((resolve, reject) => {
		const windowE = eval('window');
		if (!windowE.indexedDB) {
			reject("Indexed DB does not exists");
		}
		const indexedDbRequest = windowE.indexedDB.open("bitburnerSave", 1);

		indexedDbRequest.onupgradeneeded = function () {
			const db = indexedDbRequest.result;
			db.createObjectStore("savestring");
		};

		indexedDbRequest.onerror = function (ev) {
			reject(`Failed to get IDB ${ev}`);
		};

		indexedDbRequest.onsuccess = function () {
			const db = indexedDbRequest.result;
			if (!db) {
				reject("database loadign result was undefined");
				return;
			}
			resolve(db.transaction(["savestring"], "readwrite").objectStore("savestring"));
		};
	});
}

function load() {
	return new Promise((resolve, reject) => {
		getDB()
			.then((db) => {
				return new Promise((resolve, reject) => {
					const request = db.get("save");
					request.onerror = function (ev) {
						reject("Error in Database request to get savestring: " + ev);
					};

					request.onsuccess = function () {
						resolve(request.result);
					};
				}).then((saveString) => resolve(saveString));
			})
			.catch((r) => reject(r));
	});
}

async function save(saveString) {
	const db = await getDB();
	return await new Promise((resolve, reject) => {
		const request = db.put(saveString, "save");

		request.onerror = function (e) {
			reject("Error saving game to IndexedDB: " + e);
		};

		request.onsuccess = () => resolve();
	});
}

async function devMenu(ns) {
	const orig = React.createElement;
	const origState = React.useState;
	let stateCalls = 0;
	let resolve;
	const wrapState = function (...args) {
		stateCalls++;
		const state = origState.call(this, ...args);
		// The 2nd useState returns the page
		if (stateCalls === 2) {
			resolve(state);
			React.useState = origState;
		}
		return state;
	}
	React.createElement = function (...args) {
		const fn = args[0];
		if (typeof fn === "function" &&
			String(fn).includes("Trying to go to a page without the proper setup")) {
			React.createElement = orig;
			// Perform next-level hooking
			const wrapped = function (...args_) {
				React.useState = wrapState;
				return fn.call(this, ...args_);
			}
			return orig.call(this, wrapped, ...args.slice(1));
		}
		return orig.call(this, ...args);
	}
	const resultP = Promise.race([
		new Promise((res) => resolve = res),
		ns.asleep(5000)])
		.finally(() => {
			React.createElement = orig;
			React.useState = origState;
		});
	// Force a rerender
	ns.ui.setTheme(ns.ui.getTheme());
	const [state, setState] = await resultP;
	setState(typeof state === "string" ? "Dev" : 8);
}