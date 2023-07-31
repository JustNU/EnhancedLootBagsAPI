"use strict";

class Mod {
	// container to use outside pre-, post- loads
	static container;
	
	preAkiLoad(container) {
		// safe this reference to use instead of normal container
		Mod.container = container;
		
		// replace the function
		container.afterResolution("InventoryCallbacks", (_t, result) => {
			result.openRandomLootContainer = (pmcData, body, sessionID) => {
				return Mod.customOpenRandomLootContainer(pmcData, body, sessionID)
			}
		}, {frequency: "Always"});
	}
	
	static customOpenRandomLootContainer(pmcData, body, sessionID) {
		const logger = Mod.container.resolve("WinstonLogger");
		const invCon = Mod.container.resolve("InventoryController");
		const randomUtil = Mod.container.resolve("RandomUtil");
		const weightRanHelp = Mod.container.resolve("WeightedRandomHelper");
		
		const openedItem = pmcData.Inventory.items.find(x => x._id === body.item);
		const containerDetails = invCon.itemHelper.getItem(openedItem._tpl);
		const isSealedWeaponBox = containerDetails[1]._name.includes("event_container_airdrop");
		
		const newItemRequest = {
			tid: "RandomLootContainer",
			items: []
		};
		
		let foundInRaid = false;
		
		// Get random items and add to newItemRequest
		if (isSealedWeaponBox) {
			// Get summary of loot from config
			const containerSettings = invCon.inventoryHelper.getInventoryConfig().sealedAirdropContainer;
			newItemRequest.items.push(...invCon.lootGenerator.getSealedWeaponCaseLoot(containerSettings));

			foundInRaid = containerSettings.foundInRaid;
		} else {
			// Get summary of loot from config
			const rewardContainerDetails = invCon.inventoryHelper.getRandomLootContainerRewardDetails(openedItem._tpl);
			
			// Custom code (TO-DOl roll it into its own function, try to utilize vanilla aki functions more)
			if (rewardContainerDetails.customReward) {
				for (const itemCategory in rewardContainerDetails.rewardTplPool.chances) {
					const min = rewardContainerDetails.rewardTplPool.chances[itemCategory].min;
					const max = rewardContainerDetails.rewardTplPool.chances[itemCategory].max;
					const nValue = rewardContainerDetails.rewardTplPool.chances[itemCategory].nValue;
					const range = max - min;
					
					// get random item count from min and max values
					const itemCount = randomUtil.getBiasedRandomNumber(min, max, range, nValue);
					
					// add to new item request
					if (itemCount > 0) {
						for (let i = 0; i < itemCount; i++) {
							const chosenRewardItemTpl = weightRanHelp.getWeightedInventoryItem(rewardContainerDetails.rewardTplPool.loot[itemCategory]);
							const existingItemInRequest = newItemRequest.items.find(x => x.item_id === chosenRewardItemTpl);
							
							if (existingItemInRequest) {
								// Exists in request already, increment count
								existingItemInRequest.count++;
							} else {
								newItemRequest.items.push({item_id: chosenRewardItemTpl, count: 1, isPreset: false});
							}
						}
					}
				}
				
				// check if item(s) should be FIR
				if (openedItem.upd) {
					if (openedItem.upd.SpawnedInSession === true) {
						foundInRaid = true;
					}
				}
				
			} else {
				//vanilla code
				newItemRequest.items.push(...invCon.lootGenerator.getRandomLootContainerLoot(rewardContainerDetails));

				foundInRaid = rewardContainerDetails.foundInRaid;
			}
		}

		const output = invCon.eventOutputHolder.getOutput(sessionID);

		// Find and delete opened item from player inventory
		invCon.inventoryHelper.removeItem(pmcData, body.item, sessionID, output);

		// Add random reward items to player inventory
		invCon.inventoryHelper.addItem(pmcData, newItemRequest, output, sessionID, null, foundInRaid, null, true);

		return output;
	}
}

	
module.exports = { mod: new Mod() }