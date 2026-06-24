// controllers/productTransferController.js

const ProductTransfer = require("../models/transfer");
const Product = require("../models/product");
const mongoose = require("mongoose");
const Shop = require("../models/shop");
const Purchase = require("../models/purchase");
const PurchaseItem = require("../models/purchaseitem");
const Inventory = require("../models/inventory");


const transferProducts = async (req, res) => {
  try {
    const {
      attendantId,
      fromShopId,
      toShopId,
      products,
      useWarehouse = false,
    } = req.body;
    console.log(req.body);

    if (!attendantId || !fromShopId || !toShopId || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Incomplete transfer information." });
    }

    const attendantObjectId = new mongoose.Types.ObjectId(attendantId?._id || attendantId);
    const fromShopObjectId = new mongoose.Types.ObjectId(fromShopId);
    const toShopObjectId = new mongoose.Types.ObjectId(toShopId);

    const transferredProducts = [];
    const purchaseItems = [];
    let totalAmount = 0;

    /* ======================================================
       VALIDATION PHASE (NO WRITES)
    ====================================================== */
    const failedChecks = [];

    for (const { product, quantity } of products) {
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        failedChecks.push({ product, error: "Invalid quantity" });
        continue;
      }

      if (useWarehouse) {
        const inv = await Inventory.findOne({
          shop: fromShopObjectId,
          product,
        }).populate("product");

        if (!inv || !inv.product) {
          failedChecks.push({ product, error: "Product not found in inventory" });
          continue;
        }

        if (inv.product.productType === "product" && inv.quantity < qty) {
          failedChecks.push({
            name: inv.product.name,
            error: `Not enough stock to transfer ${qty}`,
          });
        }
      } else {
        const prod = await Product.findById(product);
        if (!prod) {
          failedChecks.push({ product, error: "Product not found" });
          continue;
        }

        if (prod.productType === "product" && prod.quantity < qty) {
          failedChecks.push({
            name: prod.name,
            error: `Not enough stock to transfer ${qty}`,
          });
        }
      }
    }

    if (failedChecks.length > 0) {
      return res.status(400).json({ error: "Product validation failed", failedChecks });
    }

    /* ======================================================
       TRANSFER PHASE (ORDER MATTERS)
    ====================================================== */

    for (const { product, quantity } of products) {
      const qty = Number(quantity);

      if (useWarehouse) {
        const inventoryInfo = await Inventory.findOne({
          shop: fromShopObjectId,
          product,
        }).populate("product");

        const productInfo = inventoryInfo.product;
        const type = productInfo.productType;
        console.log(type);

        // 1️⃣ Deduct FIRST (atomic guard)
        if (type === "product") {
          const deducted = await Inventory.updateOne(
            {
              _id: inventoryInfo._id,
              quantity: { $gte: qty },
            },
            { $inc: { quantity: -qty } }
          );

          if (deducted.modifiedCount === 0) {
            throw new Error("Stock changed, retry transfer");
          }

          totalAmount += qty * productInfo.buyingPrice;
        }

        // 2️⃣ Add to destination
          let destinationProduct =
            await Product.findOne({
              shopId: toShopObjectId,
              name: productInfo.name,
            });

          if (!destinationProduct) {

            const newProduct =
              productInfo.toObject();

            delete newProduct._id;
            delete newProduct.__v;

            newProduct.shopId =
              toShopObjectId;

            destinationProduct =
              await Product.create(newProduct);
          }

          await Inventory.findOneAndUpdate(
            {
              shop: toShopObjectId,
              product: destinationProduct._id,
            },
            {
              $inc: { quantity: qty },
              $setOnInsert: {
                shop: toShopObjectId,
                product: destinationProduct._id,
                attendant: attendantObjectId,
              },
            },
            { upsert: true }
          );

        purchaseItems.push({
          product: destinationProduct._id,
          quantity: qty,
          unitPrice: productInfo.buyingPrice,
          attendantId: attendantObjectId,
        });

        transferredProducts.push({
          product: destinationProduct._id,
          quantity: qty,
        });
      } else {
        const productInfo = await Product.findById(product);
        const type = productInfo.productType;

        if (type === "product") {
          const deducted = await Product.updateOne(
            {
              _id: productInfo._id,
              quantity: { $gte: qty },
            },
            { $inc: { quantity: -qty } }
          );

          if (deducted.modifiedCount === 0) {
            throw new Error("Stock changed, retry transfer");
          }

          totalAmount += qty * productInfo.buyingPrice;
        }

        let destinationProduct =
          await Product.findOne({
            shopId: toShopObjectId,
            name: productInfo.name,
          });

        if (!destinationProduct) {

          const newProduct =
            productInfo.toObject();

          delete newProduct._id;
          delete newProduct.__v;

          newProduct.shopId =
            toShopObjectId;

          destinationProduct =
            await Product.create(newProduct);
        }

        await Inventory.findOneAndUpdate(
          {
            shop: toShopObjectId,
            product: destinationProduct._id,
          },
          {
            $inc: { quantity: qty },
            $setOnInsert: {
              shop: toShopObjectId,
              product: destinationProduct._id,
              attendant: attendantObjectId,
            },
          },
          { upsert: true }
        );

        transferredProducts.push({
          product: destinationProduct._id,
          quantity: qty,
        });
      }
    }

    /* ======================================================
       RECORD TRANSFER + PURCHASE
    ====================================================== */
    //save history of this product to the shop its moving to
    console.log({
      attendantId: attendantObjectId,
      fromShopId: fromShopObjectId,
      toShopId: toShopObjectId,
      productId: transferredProducts,
    });
    console.log({
      attendantId: attendantObjectId,
      fromShopId: fromShopObjectId,
      toShopId: toShopObjectId,
      productId: {
        product: fromShopObjectId,
        quantity: transferredProducts.reduce(
          (sum, item) => sum + item.quantity,
          0
        ),
      }, 
    });
    await new ProductTransfer({
      attendantId: attendantObjectId,
      fromShopId: fromShopObjectId,
      toShopId: toShopObjectId,
      productId: transferredProducts,
    }).save();
    // create history of this product to the shop its moving from
    await new ProductTransfer({
      attendantId: attendantObjectId,
      fromShopId: fromShopObjectId,
      toShopId: toShopObjectId,
      productId: products.map((product) => ({
        product: product.product,
        quantity: product.quantity,
      })), 
    }).save();

    if (totalAmount > 0) {
      const purchase = await new Purchase({
        totalAmount,
        shopId: toShopObjectId,
        attendantId: attendantObjectId,
        paymentType: "cash",
      }).save();

      for (const item of purchaseItems) {
        item.purchase = purchase._id;
        await new PurchaseItem(item).save();
      }
    }

    res.status(200).json({
      success: true,
      transferred: transferredProducts.length,
      totalItems: transferredProducts.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};


const getTransferredProductsByShop = async (req, res) => {
  try {
    const {
      shopId,
      direction,
      startDate,
      endDate,
      productId,
      shops,
      limit,
      page,
      attendantId
    } = req.query;

    const criteria = {};

    // Filter by productId or shop + direction
    if (productId) {
      criteria["productId.product"] = productId;
    } else {
      if (direction === "from") {
        criteria.fromShopId = shopId;
      } else if (direction === "to") {
        criteria.toShopId = shopId;
      }
    }
    if(attendantId){
      criteria.attendantId = attendantId;
    }

    // Filter by date range
    if (startDate && endDate) {
      criteria.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Filter by shop group (either from or to)
    if (shops && shops.length > 0) {
      criteria.$or = [
        { fromShopId: { $in: shops } },
        { toShopId: { $in: shops } }
      ];
    }

    console.log("Query Criteria:", criteria);

    // Base query with population
    let query = ProductTransfer.find(criteria)
      .populate({ path: "attendantId", select: "username" })
      .populate({ path: "fromShopId", select: "name" })
      .populate({
        path: "productId",
        populate: { path: "product", select: "name" },
      })
      .populate({ path: "toShopId", select: "name" })
      .sort({ createdAt: -1 });

    // Apply pagination if both page and limit are provided
    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const pageSize = parseInt(limit, 10);
      const skip = (pageNum - 1) * pageSize;

      const total = await ProductTransfer.countDocuments(criteria);
      const data = await query.skip(skip).limit(pageSize);

      return res.status(200).json({
        data,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / pageSize),
      });
    }

    // No pagination, return full result
    const data = await query;
    res.status(200).json(data);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};


const getProductTransferHistoryByProductId = async (req, res) => {
  try {
    const { page, limit, id } = req.params;

    const pageLimit = parseInt(page) || 1;
    const limitInt = parseInt(limit) || 10;
    const skip = (pageLimit - 1) * limitInt;

    const productTransfers = await ProductTransfer.find({
      "productId.product": id,
    })
      .populate("toShopId", "name")
      .populate("fromShopId", "name")
      .populate("attendantId", "username")
      .skip(skip)
      .limit(limitInt)
      .sort({ createdAt: -1 });

    const total = await ProductTransfer.countDocuments({
      "productId.product": id,
    });

    // Transform results: only keep the matching product inside productId array
    const transformedTransfers = productTransfers.map((transfer) => {
      const matchingProduct = transfer.productId.find(
        (item) => item.product._id.toString() === id
      );

      return {
        _id: transfer._id,
        fromShopId: transfer.fromShopId,
        toShopId: transfer.toShopId,
        quantity: matchingProduct?.quantity || 0,
        product: matchingProduct?.product || null,
        createdAt: transfer.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      data: transformedTransfers,
      pagination: {
        total,
        pageLimit,
        pages: Math.ceil(total / limitInt),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getTransferredProductsByShop,
  transferProducts,
  getProductTransferHistoryByProductId,
};
