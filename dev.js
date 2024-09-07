/** @param {NS} ns */
export async function main(ns) {
  globalThis._ModuleRaid = globalThis._ModuleRaid ?? (await import('https://unpkg.com/moduleraid/dist/moduleraid.module.js')).default;
  const ModuleRaid = globalThis._ModuleRaid;
  const mR = new ModuleRaid();
  const RouterModule = mR.findModule((module) => {
    return Object.values(module).some(obj => obj.toPage !== undefined);
  })[0];
  const Router = Object.values(RouterModule).find(obj => obj.toPage !== undefined);
  Router.toPage("Dev")
}