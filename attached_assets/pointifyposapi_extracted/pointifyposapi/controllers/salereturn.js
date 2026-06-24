const SaleReturn = require("../models/salereturns");
const Product = require("../models/product");
const SaleItem = require("../models/saleitem");
const SaleModel = require("../models/sales");
const Customer = require("../models/customer");
const UserPayment = require("../models/payment");
const mongoose = require("mongoose");
const { toDateFormat, fromDateFormat } = require("../shared/validationUtils");
const Inventory = require("../models/inventory");

exports.createSaleReturn = async (req, res) => {
  try {
    const {
      saleid,
      items,
      reason,
      attendantId,
      deleteReceipt,
      shopId,
    } = req.body;

    let refundAmount = 0;

    // LOAD SALE
    let saleResponse =
      await SaleModel.findById(saleid)
        .populate("customerId")
        .populate("items")
        .lean();

    if (!saleResponse) {
      return res.status(404).json({
        error: "Receipt not found",
      });
    }

    const totalQty = items.reduce(
      (accumulator, item) =>
        accumulator + item.quantity,
      0
    );

    const totalRQty =
      saleResponse?.items?.reduce(
        (accumulator, item) =>
          accumulator + item.quantity,
        0
      );

    if (
      totalQty < totalRQty &&
      saleResponse.paymentTag == "split"
    ) {
      return res.status(404).json({
        error:
          "This sale was a split sale, you need to return the whole receipt and sell again",
      });
    }

    const productIds = items.map(
      (i) => i.product
    );

    // LOAD EVERYTHING IN PARALLEL
    const [saleItems, products] =
      await Promise.all([
        SaleItem.find({
          sale: saleid,
          product: {
            $in: productIds,
          },
        })
          .populate(
            "product",
            "manageByPrice"
          ),

        Product.find({
          _id: {
            $in: productIds,
          },
        }).lean(),
      ]);

    const saleItemMap = {};
    const productMap = {};

    saleItems.forEach((s) => {
      saleItemMap[
        s.product._id.toString()
      ] = s;
    });

    products.forEach((p) => {
      productMap[p._id.toString()] = p;
    });

    const updatedSaleItems = [];

    const bulkProductUpdates = [];
    const bulkInventoryUpdates = [];
    const saleItemOperations = [];

    // PROCESS RETURNS
    for (const returnItem of items) {
      const saleItem =
        saleItemMap[returnItem.product];

      if (!saleItem) {
        return res.status(404).json({
          error: "Sale item not found",
        });
      }

      if (
        saleItem?.product
          ?.manageByPrice === true
      ) {
        refundAmount +=
          (returnItem.quantity / saleItem.quantity) *
          saleItem.unitPrice;
      } else {
        refundAmount +=
          returnItem.quantity *
          saleItem.unitPrice;
      }

      const availableQuantity =
        saleItem.quantity;

      if (
        returnItem.quantity >
        availableQuantity
      ) {
        return res.status(400).json({
          error:
            "Not enough quantity available for the return",
        });
      }

      const newQty =
        saleItem.quantity -
        returnItem.quantity;

      if (newQty <= 0) {
        saleItemOperations.push({
          deleteOne: {
            filter: {
              _id: saleItem._id,
            },
          },
        });
      } else {
        saleItemOperations.push({
          updateOne: {
            filter: {
              _id: saleItem._id,
            },
            update: {
              quantity: newQty,
            },
          },
        });
      }

      updatedSaleItems.push({
        product: returnItem.product,
        quantity:
          returnItem.quantity,
        unitPrice:
          saleItem.unitPrice,
      });

      bulkProductUpdates.push({
        updateOne: {
          filter: {
            _id: returnItem.product,
          },
          update: {
            $inc: {
              quantity:
                returnItem.quantity,
            },
          },
        },
      });

      bulkInventoryUpdates.push({
        updateOne: {
          filter: {
            product:
              returnItem.product,
            shop: shopId,
          },
          update: {
            $inc: {
              quantity:
                returnItem.quantity,
            },
          },
          upsert: true,
        },
      });
    }

    // EXECUTE BULK OPERATIONS
    const bulkPromises = [];

    if (saleItemOperations.length) {
      bulkPromises.push(
        SaleItem.bulkWrite(
          saleItemOperations
        )
      );
    }

    if (bulkProductUpdates.length) {
      bulkPromises.push(
        Product.bulkWrite(
          bulkProductUpdates
        )
      );
    }

    if (bulkInventoryUpdates.length) {
      bulkPromises.push(
        Inventory.bulkWrite(
          bulkInventoryUpdates
        )
      );
    }

    await Promise.all(bulkPromises);

    // RELOAD UPDATED SALE
    let results =
      await SaleModel.findById(saleid)
        .populate({
          path: "items",
          populate: {
            path: "product",
            select: "name",
          },
        })
        .populate("customerId")
        .populate("attendantId")
        .lean();

    let totalValue = 0;

    results.items.forEach((obj) => {
      totalValue += obj.quantity;
    });

    // PREVIOUS RETURN
    let prevSaleReturn =
      await SaleReturn.findOne({
        saleId: saleid,
      });

    // UPDATE EXISTING RETURN
    if (prevSaleReturn) {
      updatedSaleItems.forEach(
        (returnItem) => {
          const existingItemIndex =
            prevSaleReturn.items.findIndex(
              (item) =>
                item.product.equals(
                  returnItem.product
                )
            );

          if (
            existingItemIndex !== -1
          ) {
            prevSaleReturn.items[
              existingItemIndex
            ].quantity +=
              returnItem.quantity;
          } else {
            prevSaleReturn.items.push({
              product:
                returnItem.product,
              quantity:
                returnItem.quantity,
              unitPrice:
                returnItem.unitPrice,
            });
          }
        }
      );

      prevSaleReturn.refundAmount +=
        refundAmount;

      const updateData = {
        totalAmount:
          saleResponse.totalAmount -
          refundAmount,

        totalWithDiscount:
          saleResponse.totalWithDiscount -
          refundAmount,
      };

      if (
        saleResponse.paymentType ==
        "credit"
      ) {
        updateData.outstandingBalance =
          saleResponse.outstandingBalance -
          refundAmount;
      } else {
        updateData.amountPaid =
          saleResponse.amountPaid -
          refundAmount;
      }

      await Promise.all([
        SaleModel.updateOne(
          { _id: saleid },
          updateData
        ),

        prevSaleReturn.save(),
      ]);
    } else {
      if (items.length > 0) {
        await SaleReturn.create({
          saleId: saleid,
          items: updatedSaleItems,
          refundAmount,
          customerId:
            saleResponse.customerId
              ?._id,
          attendantId,
          shopId,
          reason,
        });

        if (
          (saleResponse.paymentType ==
            "wallet" &&
            saleResponse.customerId) ||
          saleResponse.paymentType ==
          "credit"
        ) {
          const lastPayment =
            await UserPayment.findOne({
              customerId:
                saleResponse.customerId,
            })
              .sort({
                createdAt: -1,
              })
              .lean();

          await Promise.all([
            UserPayment.create({
              type: "refund",
              shopId,
              customerId:
                saleResponse.customerId,
              attendantId,
              totalAmount:
                refundAmount,
              balance:
                (lastPayment
                  ?.balance ?? 0) +
                refundAmount,
            }),

            Customer.findByIdAndUpdate(
              saleResponse.customerId
                ._id,
              {
                $inc: {
                  wallet:
                    refundAmount,
                },
              }
            ),
          ]);
        }

        const updateData = {
          totalAmount:
            saleResponse.totalAmount -
            refundAmount,

          totalWithDiscount:
            saleResponse.totalWithDiscount -
            refundAmount,
        };

        if (
          saleResponse.paymentType ==
          "credit"
        ) {
          updateData.outstandingBalance =
            saleResponse.outstandingBalance -
            refundAmount;
        } else {
          updateData.amountPaid =
            saleResponse.amountPaid -
            refundAmount;
        }

        await SaleModel.updateOne(
          { _id: saleid },
          updateData
        );
      }
    }

    // DELETE EMPTY RECEIPT
    if (totalValue == 0) {
      await Promise.all([
        SaleItem.deleteMany({
          sale: saleid,
        }),

        SaleModel.findByIdAndDelete(
          saleid
        ),
      ]);

      return res.status(201).json({
        deleteReceipt,
      });
    }

    return res.status(201).json({
      saleReturn: results,
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      error:
        "Error creating sale return",
    });
  }
};

exports.getSaleReturn = async (req, res) => {
  try {
    const {
      saleId,
      customerId,
      attendantId,
      productId,
      fromDate,
      toDate,
      shopId,
      paginated = false,
      page = 1,
      limit = 10,
    } = req.query;

    const filters = {};

    if (saleId) {
      filters.saleId = saleId;
    }

    if (customerId) {
      filters.customerId = customerId;
    }

    if (attendantId) {
      filters.attendantId = attendantId;
    }

    if (shopId) {
      filters.shopId = new mongoose.Types.ObjectId(shopId);
    }

    if (productId) {
      filters["items.product"] = productId;
    }

    if (fromDate && toDate) {
      filters.createdAt = {
        $gte: fromDateFormat(fromDate),
        $lte: toDateFormat(toDate),
      };
    }


    const query = SaleReturn.find(filters)
      .populate({
        path: "customerId",
        select: "name",
      })
      .populate({
        path: "attendantId",
        select: "username",
      })
      .populate({
        path: "items.product",
        select: "name",
      })
      .sort({ createdAt: -1 });

    // Handle pagination
    if (paginated === "true" || paginated === true) {
      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;

      const total = await SaleReturn.countDocuments(filters);
      const totalPages = Math.ceil(total / pageSize);

      const saleReturns = await query
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .exec();

      return res.json({
        data: saleReturns,
        pagination: {
          total,
          page: pageNumber,
          totalPages,
          pageSize,
        },
      });
    }

    // No pagination
    const saleReturns = await query.exec();
    res.json(saleReturns);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error fetching sale returns" });
  }
};


exports.updateSaleReturn = async (req, res) => {
  try {
    const saleReturnId = req.params.id; // Assuming you pass the sale return ID in the URL
    const { originalSaleId, items, refundAmount, reason } = req.body; // Destructure the fields to update

    // Find and update the sale return by its ID
    const updateSaleReturn = await SaleReturn.findByIdAndUpdate(
      saleReturnId,
      {
        originalSaleId,
        items,
        refundAmount,
        reason,
      },
      { new: true } // Return the updated document
    );

    if (!updateSaleReturn) {
      return res.status(404).json({ error: "Sale return not found" });
    }

    // Respond with the updated sale return
    res.json(updateSaleReturn);
  } catch (error) {
    res.status(500).json({ error: "Error updating sale return" });
  }
};

exports.deleteSaleReturn = async (req, res) => {
  try {
    const saleReturnId = req.params.id; // Assuming you pass the sale return ID in the URL
    // Find and delete the sale return by its ID
    const deletedSaleReturn = await SaleReturn.findByIdAndRemove(saleReturnId);

    if (!deletedSaleReturn) {
      return res.status(404).json({ error: "Sale return not found" });
    }

    // Respond with a success message or the deleted sale return
    res.json({ message: "Sale return deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting sale return" });
  }
};
