# Bitburner
My Bitburner scripts

# Batcher
Usage:
`run hacking/JIT_v4.js [batchSpacer]`
- batchSpacer defaults to 70, could technically be as low as 20, but IRL computer performance affects stability. (Suggested between 70 and 30 included)
- Includes home ram and cores upgrading, private servers purchasing and upgrading, server nuking.
- Defaults to not using hashnet servers as it uses hashes to lower target minimum security and maximum money.
- Automatically switches to the 'dumber' shotgun_v4 if the conditions aren't good enough to run JIT at even a basic level

# Augmentations
Usage:
`run upgrades/augmentations.js [hack|crime|corp]`
- Includes automatic faction selection prioritizing the specified objective, faction requirement satisfaction, faction joining, augment purchase and installation.

# Contracts
Usage:
`run contracts/auto_solve.js`
- All contract types are supported, some contracts require up to 30 seconds to complete.

# Gang
Usage:
`run gang/auto_gang.js`
- Includes everything gang related.
- Only supports combat gang style.

# Corporation
Usage:
`run corporation/auto_corp.js`
- Includes corporation creation, heavily structured optimized logic for investor rounds 1 and 2, dynamic logic from round 3 onwards.
- Currently only supports an Agriculture/Chemical/Tobacco strategy, while the logic changes required to support more divisions are not significant I have no reason to add it at this point it time.
- It is able to recover from being killed at almost any point: does not re-attempt to set smart supply or market ta 2 if killed while setting them.
- Partially supports bitnodes with a valuation multiplier lower than 1: the script will work, but round 2 and 3 will be significantly slower.

# Bladeburner
Currently not supported.

# Stocks
Usage:
`run stocks/stocks.js`
- Supports stocks without 4S but requires 5 minutes startup to create a market history. (Can be lowered, but script perfomance is linked to history size)
- Includes automatic 4S purchase and logic can be fine tuned through the flags at the start of the file.
- Limit orders are intentionally not supported.
- NOTE: The script automatically sells ALL stocks/shorts when killed!

# Hacknet
Usage:
`run hacknet/hashnet.js`
- Includes optimized upgrade logic, automatically spawns coding contracts as soon as it can, converts hashes to money if it reaches hash capacity.

# IpVGo 
Usage: 
`run ipvgo/sphyxis.js`
- Not mine, will be replaced in the future.

# Sleeves
Usage:
`run sleeves/auto_assign.js`
- Include shock recovery, optimized karma farming, sleeve augmentation install, work for joined factions/companies which require reputation.

# Stanek
Usage:
`run stanek/auto_charge.js [targetCharge]`
- Specifying a targetCharge lesser than or equal to 2000 is suggested.
- Has automatic charge logic but it is work in progress.
