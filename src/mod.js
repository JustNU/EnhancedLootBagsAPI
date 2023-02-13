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
		const inventoryController = Mod.container.resolve("InventoryController");
		const randomUtil = Mod.container.resolve("RandomUtil");
		const openedItem = pmcData.Inventory.items.find(x => x._id === body.item);
		const rewardContainerDetails = inventoryController.inventoryHelper.getRandomLootContainerRewardDetails(openedItem._tpl);
		
		const newItemRequest = {
            tid: "RandomLootContainer",
            items: []
        };
		
		// Get random items and add to newItemRequest
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
						const chosenRewardItemTpl = inventoryController.weightedRandomHelper.getWeightedInventoryItem(rewardContainerDetails.rewardTplPool.loot[itemCategory]);
						const existingItemInRequest = newItemRequest.items.find(x => x.item_id === chosenRewardItemTpl);
						
						if (existingItemInRequest) {
							// Exists in request already, increment count
							existingItemInRequest.count++;
						} else {
							newItemRequest.items.push({item_id: chosenRewardItemTpl, count: 1});
						}
					}
				}
			}
			
			// change FIR accordingly to opened item FIR status
			rewardContainerDetails.foundInRaid = false;
			
			if (openedItem.upd) {
				if (openedItem.upd.SpawnedInSession === true) {
					rewardContainerDetails.foundInRaid = true;
				}
			}
		} else {
			for (let index = 0; index < rewardContainerDetails.rewardCount; index++) {
				const chosenRewardItemTpl = inventoryController.weightedRandomHelper.getWeightedInventoryItem(rewardContainerDetails.rewardTplPool);
				const existingItemInRequest = newItemRequest.items.find(x => x.item_id === chosenRewardItemTpl);
				
				if (existingItemInRequest) {
					// Exists in request already, increment count
					existingItemInRequest.count++;
				} else {
					newItemRequest.items.push({item_id: chosenRewardItemTpl, count: 1});
				}
			}
		}

        const output = inventoryController.eventOutputHolder.getOutput(sessionID);

        // Find and delete opened item from player inventory
        inventoryController.inventoryHelper.removeItem(pmcData, body.item, sessionID, output);

        // Add random reward items to player inventory
        inventoryController.inventoryHelper.addItem(pmcData, newItemRequest, output, sessionID, null, rewardContainerDetails.foundInRaid);

        return output;
	}
}

	
module.exports = { mod: new Mod() }