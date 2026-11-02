/**
 * Diwali Products Seed Script
 * ----------------------------
 * 1. Deletes ALL existing products (demo data)
 * 2. Deletes old categories and creates new Diwali categories
 * 3. Creates 3 F1RST brand Diwali products with INR pricing
 *
 *   npx medusa exec ./src/scripts/seed-diwali-products.ts
 */
import {
  deleteProductsWorkflow,
  createProductCategoriesWorkflow,
  deleteProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";

export default async function seedDiwaliProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  // ─── Step 1: Delete ALL existing products ─────────────────────────────────
  logger.info("Step 1: Deleting all existing products...");

  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "title"],
  });

  if (existingProducts.length > 0) {
    logger.info(`Found ${existingProducts.length} products to delete.`);

    // Delete in batches of 10 to avoid timeouts
    const BATCH_SIZE = 10;
    for (let i = 0; i < existingProducts.length; i += BATCH_SIZE) {
      const batch = existingProducts.slice(i, i + BATCH_SIZE);
      const ids = batch.map((p) => p.id as string);

      await deleteProductsWorkflow(container).run({
        input: { ids },
      });

      logger.info(
        `Deleted ${Math.min(i + BATCH_SIZE, existingProducts.length)}/${existingProducts.length} products`
      );
    }

    logger.info("✅ All existing products deleted.");
  } else {
    logger.info("No existing products found. Skipping deletion.");
  }

  // ─── Step 2: Delete old categories and create Diwali categories ───────────
  logger.info("Step 2: Setting up Diwali categories...");

  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
  });

  if (existingCategories.length > 0) {
    logger.info(
      `Deleting ${existingCategories.length} old categories: ${existingCategories.map((c) => c.name).join(", ")}`
    );
    await deleteProductCategoriesWorkflow(container).run({
      input: existingCategories.map((c) => c.id as string),
    });
    logger.info("✅ Old categories deleted.");
  }

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Diwali Essentials",
          is_active: true,
          handle: "diwali-essentials",
        },
        {
          name: "Diwali Complete Celebration",
          is_active: true,
          handle: "diwali-complete-celebration",
        },
        {
          name: "FOR YOUR LOVE ❤️",
          is_active: true,
          handle: "for-your-love",
        },
        {
          name: "Others",
          is_active: true,
          handle: "others",
        },
      ],
    },
  });

  logger.info(
    `✅ Created ${categoryResult.length} Diwali categories: ${categoryResult.map((c) => c.name).join(", ")}`
  );

  const diwaliEssentials = categoryResult.find(
    (c) => c.name === "Diwali Essentials"
  )!;
  const diwaliComplete = categoryResult.find(
    (c) => c.name === "Diwali Complete Celebration"
  )!;

  // ─── Step 3: Get prerequisites ────────────────────────────────────────────
  logger.info("Step 3: Fetching prerequisites...");

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  });
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });

  const salesChannel = salesChannels[0];
  const shippingProfile = shippingProfiles[0];

  if (!salesChannel || !shippingProfile) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No sales channel or shipping profile found. Run the initial data seed first."
    );
  }

  logger.info(`Using sales channel: "${salesChannel.name}"`);

  // ─── Step 4: Create Diwali products ───────────────────────────────────────
  logger.info("Step 4: Creating Diwali products...");

  const products = [
    {
      title: "Water Diyas",
      handle: "water-diyas",
      subtitle: "Traditional Diwali Diyas",
      description:
        "Beautiful traditional water diyas to illuminate your Diwali celebrations. Crafted with care, these diyas bring the warmth and light of the festival into your home. Perfect for floating in water to create a mesmerizing display of lights during the festive season.",
      status: ProductStatus.PUBLISHED,
      thumbnail:
        "https://images.unsplash.com/photo-1604423539530-540e1a0d4628?w=800&q=80",
      images: [
        {
          url: "https://images.unsplash.com/photo-1604423539530-540e1a0d4628?w=800&q=80",
        },
      ],
      weight: 200,
      shipping_profile_id: shippingProfile.id,
      category_ids: [diwaliEssentials.id],
      sales_channels: [{ id: salesChannel.id }],
      variants: [
        {
          title: "Default",
          sku: "WATER-DIYAS-DEFAULT",
          manage_inventory: false,
          prices: [
            {
              amount: 20,
              currency_code: "inr",
            },
          ],
        },
      ],
    },
    {
      title: "Rangoli Stencils",
      handle: "rangoli-stencils",
      subtitle: "F1RST Rangoli Stencils Set",
      description:
        "Create stunning rangoli designs effortlessly with our premium F1RST Rangoli Stencils. This set includes beautifully designed stencils featuring traditional motifs — lotus, Ganesha, diya, and footprints. Made from durable material, these stencils are reusable and perfect for creating vibrant rangoli patterns during Diwali festivities.",
      status: ProductStatus.PUBLISHED,
      thumbnail:
        "https://images.unsplash.com/photo-1605359817844-4d7a15b35b1d?w=800&q=80",
      images: [
        {
          url: "https://images.unsplash.com/photo-1605359817844-4d7a15b35b1d?w=800&q=80",
        },
      ],
      weight: 150,
      shipping_profile_id: shippingProfile.id,
      category_ids: [diwaliEssentials.id],
      sales_channels: [{ id: salesChannel.id }],
      variants: [
        {
          title: "Default",
          sku: "RANGOLI-STENCILS-DEFAULT",
          manage_inventory: false,
          prices: [
            {
              amount: 120,
              currency_code: "inr",
            },
          ],
        },
      ],
    },
    {
      title: "6 Rangoli Colour + 1 Unique Colour + 4 Rangoli Stencils",
      handle: "rangoli-colour-stencil-combo",
      subtitle: "F1RST Diwali Complete Celebration Pack",
      description:
        "The ultimate Diwali celebration pack by F1RST! Includes 6 vibrant rangoli colours (Pink, Yellow, Blue, Orange, Green, Purple) plus 1 special Golden colour, along with 4 beautiful rangoli stencils. Everything you need to create stunning, colourful rangoli art for your Diwali decorations. Vibrant • Safe • Festive — More Colours, More Joy!",
      status: ProductStatus.PUBLISHED,
      thumbnail:
        "https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80",
      images: [
        {
          url: "https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80",
        },
      ],
      weight: 500,
      shipping_profile_id: shippingProfile.id,
      category_ids: [diwaliComplete.id],
      sales_channels: [{ id: salesChannel.id }],
      variants: [
        {
          title: "Default",
          sku: "RANGOLI-COMBO-DEFAULT",
          manage_inventory: false,
          prices: [
            {
              amount: 185,
              currency_code: "inr",
            },
          ],
        },
      ],
    },
  ];

  await createProductsWorkflow(container).run({
    input: { products: products as never },
  });

  logger.info("✅ Created 3 Diwali products:");
  logger.info("   1. Water Diyas — ₹20 (Diwali Essentials)");
  logger.info("   2. Rangoli Stencils — ₹120 (Diwali Essentials)");
  logger.info(
    "   3. Rangoli Colour + Stencils Combo — ₹185 (Diwali Complete Celebration)"
  );

  // ─── Step 5: Update search index ──────────────────────────────────────────
  logger.info("Step 5: Updating search index...");

  const search = container.resolve(Modules.SEARCH);
  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["id"],
  });

  await search.ingest({
    name: "product.created",
    data: allProducts.map((p) => ({ id: p.id })),
  } as never);

  logger.info(`✅ Search index updated for ${allProducts.length} product(s).`);
  logger.info("");
  logger.info("🎉 Diwali store is ready! Your products:");
  logger.info("   🪔 Water Diyas — ₹20");
  logger.info("   🎨 Rangoli Stencils — ₹120");
  logger.info("   🎊 Complete Celebration Pack — ₹185");
}
