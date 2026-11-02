/**
 * Setup India Region Script
 * --------------------------
 * Adds INR currency support and creates an India region with Indian shipping.
 * Safe to run multiple times — checks for existing data before creating.
 *
 *   npx medusa exec ./src/scripts/setup-india-region.ts
 */
import {
  createRegionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  createShippingOptionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";

export default async function setupIndiaRegion({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const fulfillmentModuleService = container.resolve("fulfillment" as any);
  const storeModuleService = container.resolve("store" as any);

  // ─── Step 1: Add INR to store currencies ──────────────────────────────────
  logger.info("Step 1: Adding INR currency to store...");

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code"],
  });

  const store = stores[0];
  if (!store) {
    logger.error("No store found!");
    return;
  }

  const existingCurrencies = (store.supported_currencies ?? []).map(
    (c: any) => c.currency_code
  );

  if (!existingCurrencies.includes("inr")) {
    await storeModuleService.updateStores(store.id, {
      supported_currencies: [
        ...existingCurrencies.map((code: string) => ({
          currency_code: code,
          is_default: false,
        })),
        {
          currency_code: "inr",
          is_default: true,
        },
      ],
    });
    logger.info("✅ Added INR as default currency.");
  } else {
    logger.info("INR already exists in store currencies.");
  }

  // ─── Step 2: Check if India region already exists ─────────────────────────
  logger.info("Step 2: Setting up India region...");

  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
  });

  const indiaRegion = existingRegions.find(
    (r) => r.name === "India"
  );

  let regionId: string;

  if (indiaRegion) {
    logger.info("India region already exists. Skipping creation.");
    regionId = indiaRegion.id as string;
  } else {
    const { result: regionResult } = await createRegionsWorkflow(
      container
    ).run({
      input: {
        regions: [
          {
            name: "India",
            currency_code: "inr",
            countries: ["in"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    regionId = regionResult[0].id;
    logger.info("✅ Created India region with INR currency.");
  }

  // ─── Step 3: Create tax region for India ──────────────────────────────────
  logger.info("Step 3: Setting up India tax region...");

  try {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "in",
          provider_id: "tp_system",
        },
      ],
    });
    logger.info("✅ Created India tax region.");
  } catch (e: any) {
    if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
      logger.info("India tax region already exists. Skipping.");
    } else {
      logger.warn(`Tax region creation note: ${e.message}`);
    }
  }

  // ─── Step 4: Create India stock location ──────────────────────────────────
  logger.info("Step 4: Setting up India warehouse...");

  const { data: existingLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  });

  const indiaWarehouse = existingLocations.find(
    (l) => l.name === "India Warehouse"
  );

  let stockLocationId: string;

  if (indiaWarehouse) {
    logger.info("India Warehouse already exists. Skipping creation.");
    stockLocationId = indiaWarehouse.id as string;
  } else {
    const { result: stockLocationResult } =
      await createStockLocationsWorkflow(container).run({
        input: {
          locations: [
            {
              name: "India Warehouse",
              address: {
                city: "Mumbai",
                country_code: "IN",
                address_1: "",
              },
            },
          ],
        },
      });
    stockLocationId = stockLocationResult[0].id;

    // Link to fulfillment provider
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocationId,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "manual_manual",
      },
    });

    logger.info("✅ Created India Warehouse in Mumbai.");
  }

  // ─── Step 5: Create fulfillment set + shipping options for India ──────────
  logger.info("Step 5: Setting up India shipping...");

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = shippingProfiles[0];

  try {
    const fulfillmentSet =
      await fulfillmentModuleService.createFulfillmentSets({
        name: "India Warehouse Delivery",
        type: "shipping",
        service_zones: [
          {
            name: "India",
            geo_zones: [
              {
                country_code: "in",
                type: "country",
              },
            ],
          },
        ],
      });

    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocationId,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    });

    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Standard Shipping",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Delivery in 5-7 business days.",
            code: "standard",
          },
          prices: [
            {
              currency_code: "inr",
              amount: 50,
            },
            {
              region_id: regionId,
              amount: 50,
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
        {
          name: "Express Shipping",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Express",
            description: "Delivery in 1-2 business days.",
            code: "express",
          },
          prices: [
            {
              currency_code: "inr",
              amount: 100,
            },
            {
              region_id: regionId,
              amount: 100,
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
      ],
    });

    logger.info("✅ Created Standard (₹50) and Express (₹100) shipping options.");
  } catch (e: any) {
    logger.warn(`Shipping setup note: ${e.message}`);
  }

  // ─── Step 6: Link sales channel to India stock location ───────────────────
  logger.info("Step 6: Linking sales channel...");

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
  });

  if (salesChannels[0]) {
    try {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: {
          id: stockLocationId,
          add: [salesChannels[0].id as string],
        },
      });
      logger.info("✅ Linked India Warehouse to Default Sales Channel.");
    } catch (e: any) {
      logger.info("Sales channel already linked or note: " + e.message);
    }
  }

  logger.info("");
  logger.info("🇮🇳 India region setup complete!");
  logger.info("   Currency: INR (₹)");
  logger.info("   Region: India");
  logger.info("   Warehouse: Mumbai, India");
  logger.info("   Standard Shipping: ₹50 (5-7 days)");
  logger.info("   Express Shipping: ₹100 (1-2 days)");
}
