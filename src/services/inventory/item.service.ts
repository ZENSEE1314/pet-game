import {
  ItemCategory,
  CurrencyType,
  TransactionDirection,
  TransactionCategory,
  AcquisitionSource,
  MissionType,
  Prisma,
} from '@prisma/client';

import { prisma, runSerializable } from '@/lib/db';
import { AppError } from '@/lib/api';
import { clamp } from '@/lib/utils';
import { recordTransaction } from '@/services/currency/transaction.service';
import { trackMissionProgress } from '@/services/mission/mission.service';
import { grantEnergy } from '@/services/game/energy.service';
import { applyDecay, deriveHealthState } from '@/services/pet/decay';

/**
 * The item shop and inventory.
 *
 * The price is read from the database, never from the request. The client sends
 * `{ itemId, quantity }` and nothing else — if it were allowed to send a price,
 * everything in the shop would cost one coin by tea time.
 */

export async function listShopItems(userId?: string) {
  const items = await prisma.item.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: [{ category: 'asc' }, { coinPrice: 'asc' }],
  });

  if (!userId) return items.map((item) => ({ ...item, owned: 0 }));

  const inventory = await prisma.userInventory.findMany({
    where: { userId },
    select: { itemId: true, quantity: true },
  });
  const ownedByItem = new Map(inventory.map((row) => [row.itemId, row.quantity]));

  return items.map((item) => ({ ...item, owned: ownedByItem.get(item.id) ?? 0 }));
}

export async function getInventory(userId: string) {
  const rows = await prisma.userInventory.findMany({
    where: { userId, quantity: { gt: 0 } },
    include: { item: true },
    orderBy: [{ item: { category: 'asc' } }, { acquiredAt: 'desc' }],
  });

  return rows.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    isEquipped: row.isEquipped,
    source: row.source,
    acquiredAt: row.acquiredAt,
    item: row.item,
    isConsumable: isConsumable(row.item.category),
    isEquippable: row.item.category === ItemCategory.CLOTHING,
  }));
}

function isConsumable(category: ItemCategory): boolean {
  return (
    category === ItemCategory.FOOD ||
    category === ItemCategory.MEDICINE ||
    category === ItemCategory.GAME_TICKET
  );
}

// --- Purchase ---------------------------------------------------------------

export interface PurchaseResult {
  itemId: string;
  itemName: string;
  quantity: number;
  currency: CurrencyType;
  totalCost: number;
  balanceAfter: number;
  newQuantity: number;
}

export async function purchaseItem(
  userId: string,
  itemId: string,
  quantity: number,
  currency: CurrencyType = CurrencyType.COINS,
): Promise<PurchaseResult> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new AppError('VALIDATION_ERROR', 'Quantity must be between 1 and 99.');
  }

  // Reward points buy real-world rewards, not pet food. Letting them buy items
  // would create a second, unaudited sink for a currency that has real value.
  if (currency === CurrencyType.REWARD_POINTS) {
    throw new AppError('FORBIDDEN', 'Reward points can only be spent in the reward shop.');
  }

  const now = new Date();

  return runSerializable(
    async (tx) => {
      const item = await tx.item.findFirst({
        where: { id: itemId, isActive: true, deletedAt: null },
      });
      if (!item) throw new AppError('NOT_FOUND', 'That item is not available.');

      const unitPrice = currency === CurrencyType.GEMS ? item.gemPrice : item.coinPrice;
      if (unitPrice === null || unitPrice === undefined) {
        throw new AppError('CONFLICT', `This item cannot be bought with ${currency.toLowerCase()}.`);
      }

      const totalCost = unitPrice * quantity;

      const existing = await tx.userInventory.findUnique({
        where: { userId_itemId: { userId, itemId } },
      });

      const newQuantity = (existing?.quantity ?? 0) + quantity;
      if (item.isStackable && newQuantity > item.maxStack) {
        throw new AppError(
          'LIMIT_REACHED',
          `You can only hold ${item.maxStack} × ${item.name}.`,
        );
      }
      if (!item.isStackable && newQuantity > 1) {
        throw new AppError('CONFLICT', `You already own ${item.name}.`);
      }

      const debit = await recordTransaction(tx, {
        userId,
        currency,
        direction: TransactionDirection.DEBIT,
        amount: totalCost,
        category: TransactionCategory.ITEM_PURCHASE,
        description: `Bought ${quantity} × ${item.name}`,
        referenceType: 'Item',
        referenceId: itemId,
        idempotencyKey: `purchase:${userId}:${itemId}:${now.getTime()}`,
      });

      await tx.userInventory.upsert({
        where: { userId_itemId: { userId, itemId } },
        create: {
          userId,
          itemId,
          quantity,
          source: AcquisitionSource.SHOP_PURCHASE,
        },
        update: { quantity: { increment: quantity } },
      });

      return {
        itemId,
        itemName: item.name,
        quantity,
        currency,
        totalCost,
        balanceAfter: debit.balanceAfter,
        newQuantity,
      };
    },
  );
}

// --- Use --------------------------------------------------------------------

export interface UseItemResult {
  itemName: string;
  remaining: number;
  petStats?: Record<string, number>;
  gameEnergy?: number;
}

// Named `consumeItem` rather than `useItem`: the `use` prefix makes linters (and
// readers) take it for a React hook, and this is a server-side service function.
export async function consumeItem(userId: string, itemId: string): Promise<UseItemResult> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const stack = await tx.userInventory.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    });

    if (!stack || stack.quantity < 1) {
      throw new AppError('NOT_FOUND', 'You do not have that item.');
    }
    if (!isConsumable(stack.item.category)) {
      throw new AppError('CONFLICT', `${stack.item.name} is not a consumable item.`);
    }

    // Conditional decrement: two taps on "Use" race here, and only one consumes.
    const consumed = await tx.userInventory.updateMany({
      where: { userId, itemId, quantity: { gte: 1 } },
      data: { quantity: { decrement: 1 } },
    });
    if (consumed.count === 0) {
      throw new AppError('CONFLICT', 'That item was already used.');
    }

    const result: UseItemResult = {
      itemName: stack.item.name,
      remaining: stack.quantity - 1,
    };

    // Game tickets restore game energy rather than pet stats.
    if (stack.item.gameEnergyRestore > 0) {
      const energy = await grantEnergy(tx, userId, stack.item.gameEnergyRestore);
      result.gameEnergy = energy.current;
    }

    const affectsPet =
      stack.item.hungerRestore > 0 ||
      stack.item.happinessRestore > 0 ||
      stack.item.energyRestore > 0 ||
      stack.item.cleanlinessRestore > 0 ||
      stack.item.healthRestore > 0 ||
      stack.item.friendshipBonus > 0;

    if (affectsPet) {
      const pet = await tx.pet.findFirst({
        where: { userId, deletedAt: null },
        include: { species: true },
      });
      if (!pet) throw new AppError('NOT_FOUND', 'You need a pet to use that item.');

      const decayed = applyDecay(pet, pet.species, now);

      const next = {
        hunger: clamp(decayed.hunger + stack.item.hungerRestore),
        happiness: clamp(decayed.happiness + stack.item.happinessRestore),
        energy: clamp(decayed.energy + stack.item.energyRestore),
        cleanliness: clamp(decayed.cleanliness + stack.item.cleanlinessRestore),
        health: clamp(decayed.health + stack.item.healthRestore),
        friendship: clamp(pet.friendship + stack.item.friendshipBonus),
      };

      await tx.pet.update({
        where: { id: pet.id },
        data: {
          ...next,
          healthState: deriveHealthState(next.health, next.energy),
          statsUpdatedAt: now,
        },
      });

      result.petStats = next;
    }

    await trackMissionProgress(tx, userId, MissionType.USE_ITEM, 1, { itemSlug: stack.item.slug });

    return result;
  });
}

// --- Equip ------------------------------------------------------------------

export async function equipItem(userId: string, itemId: string, equip: boolean) {
  return prisma.$transaction(async (tx) => {
    const stack = await tx.userInventory.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    });

    if (!stack || stack.quantity < 1) {
      throw new AppError('NOT_FOUND', 'You do not have that item.');
    }
    if (stack.item.category !== ItemCategory.CLOTHING) {
      throw new AppError('CONFLICT', `${stack.item.name} cannot be worn.`);
    }

    const pet = await tx.pet.findFirst({ where: { userId, deletedAt: null } });
    if (!pet) throw new AppError('NOT_FOUND', 'You need a pet first.');

    // One outfit at a time in the MVP: unequip everything, then equip the target.
    await tx.userInventory.updateMany({
      where: { userId, isEquipped: true },
      data: { isEquipped: false },
    });

    if (equip) {
      await tx.userInventory.update({
        where: { id: stack.id },
        data: { isEquipped: true },
      });
    }

    await tx.pet.update({
      where: { id: pet.id },
      data: { equippedItemId: equip ? itemId : null },
    });

    return { itemId, isEquipped: equip, itemName: stack.item.name };
  });
}
