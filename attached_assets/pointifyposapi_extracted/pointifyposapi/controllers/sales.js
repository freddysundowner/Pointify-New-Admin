const Sale = require("../models/sales");
const SaleReturn = require("../models/salereturns");
const Product = require("../models/product");
const UserPayment = require("../models/payment");
const SaleItem = require("../models/saleitem");
const Inventory = require("../models/inventory");
const Batch = require("../models/batch");
const Customer = require("../models/customer");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");
const path = require("path");
const { toDateFormat, fromDateFormat } = require("../shared/validationUtils");
const { totalSalesCalculations } = require("../shared/sales");
const saleitem = require("../models/saleitem");
const { sendEmail } = require("../shared/emailsetup");
const Shop = require("../models/shop");
const XLSX = require("xlsx");
const fs = require("fs");
const Order = require("../models/order");
const OrderItem = require("../models/orderitems");
const { sendSaleSmsAfterSale } = require("../shared/functions")
const { allocatePayment } = require("@src_v2/controllers/mpesa");
BATCH_SIZE = 200;
exports.updateSaleSandbox = async (req, res) => {
  try {
    let skip = 0;
    let hasMoreProducts = true;
    let updatedProducts = [];
    let updateCount = 0;

    while (hasMoreProducts) {
      const products = await Product.find({})
        .skip(skip)
        .limit(BATCH_SIZE)
        .populate("measureUnit");

      if (products.length === 0) {
        hasMoreProducts = false;
        break;
      }

      for (let product of products) {
        if (product.measureUnit && product.measureUnit.name) {
          product.measure = product.measureUnit.name;
          await product.save();
          updatedProducts.push(product); // Collect updated products
          updateCount++; // Increment the update count
        }
      }

      skip += BATCH_SIZE;
    }
    res.status(200).json({
      message: "All products updated successfully",
      updatedProducts,
      updateCount,
    });
  } catch (error) {
    console.error("Error updating products:", error);
    res.status(500).json({ error: "Error updating products" });
  }

  // try {
  //   let shopId = req.params.id;
  //   const sales = await Sale.find({ shopId }).select('_id createdAt');

  //   if (sales.length === 0) {
  //     console.log(`No sales found for shop ID: ${shopId}`);
  //     return res.status(404).json({ error: `No sales found for shop ID: ${shopId}` });
  //   }

  //   let totalUpdatedCount = 0;

  //   for (const sale of sales) {
  //     console.log(`Checking sale items for sale: ${sale._id}`);

  //     // Convert sale.createdAt to ISODate string without time for comparison
  //     const saleDate = new Date(sale.createdAt.toISOString().split('T')[0]);

  //     // Find sale items that need to be updated
  //     const saleItemsToUpdate = await SaleItem.aggregate([
  //       {
  //         $match: {
  //           sale: sale._id,
  //           $expr: {
  //             $ne: [
  //               { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
  //               { $dateToString: { format: "%Y-%m-%d", date: saleDate } }
  //             ]
  //           }
  //         }
  //       }
  //     ]);

  //     if (saleItemsToUpdate.length > 0) {
  //       console.log(`Updating ${saleItemsToUpdate.length} sale items for sale: ${sale._id}`);

  //       const result = await SaleItem.updateMany(
  //         { sale: sale._id, _id: { $in: saleItemsToUpdate.map(item => item._id) } },
  //         { $set: { createdAt: sale.createdAt } }
  //       );
  //       totalUpdatedCount += 1; // Add the number of modified documents to the total count
  //     }
  //   }

  //   console.log(`Update complete, total items updated: ${totalUpdatedCount}`);
  //   return res.status(200).json({ message: "Update complete", totalUpdatedCount });
  // } catch (error) {
  //   console.error("Error updating sale items", error);
  //   return res.status(500).json({ error: `Error updating sale items: ${error.message}` });
  // }
};

exports.deleteonlineSale = async (req, res) => {
  let { id } = req.params;
  console.log(id);
  let sale = await Order.deleteOne({ _id: id });
  res.json({ status: true });
};

exports.updateSale = async (req, res) => {
  try {
    let {
      products,
      shopId,
      customerId,
      attendantId,
      paymentType,
      totalDiscount,
      payments,
      status,
      order,
      type,
      amountPaid
    } = req.body;
    console.log(req.body);
    if (type == "order") {
      let sale = await Order.findOne(req.params.id)
        .populate({
          path: "items",
          populate: {
            path: "product",
          },
        })
        .populate("shop")
        .populate("customer");
      if (status == "cancelled") {
        sale.status = "cancelled";
        await sale.save();
        return res.status(201).json({
          message: "Order Cancelled successfully",
          sale: sale,
        });
      }

      let items = [];
      sale.items.forEach((item) => {
        items.push(
          '<tr><td style="padding: 10px; border-bottom: 1px solid #ddd;">' +
          item.product.name +
          '</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">' +
          item.quantity +
          '</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">' +
          sale.shop.currency +
          "" +
          item.quantity * item.sellingPrice +
          "</td></tr>"
        );
      });
      const replacements = {
        username: sale.customer.name,
        items,
        orderid: sale.receiptNo,
        status,
      };
      sendEmail(
        sale.customer.email,
        "Order Status",
        "orderStatus",
        replacements
      );

      return res.status(201).json({
        message: "Order updated successfully",
        sale: sale,
      });
    }

    if (!products && status == "cashed") {
      let saledata = await Sale.findById(req.params.id);
      if (saledata?.status == "hold" && saledata?.customerId) {
        // deduct from wallet
        let customer = await Customer.findById(saledata.customerId);
        customer.wallet = customer.wallet - amountPaid ? amountPaid : saledata.outstandingBalance;
        await customer.save();
      }
      let ressales = await Sale.findByIdAndUpdate(req.params.id, req.body)
        .populate("attendantId", "username")
        .populate("shopId", "name")
        .populate("customerId", "name wallet customerNo")
        .populate("items.product", "name")
        .populate({
          path: "items",
          populate: {
            path: "product",
          },
        });
      await saleitem.findOneAndUpdate({ sale: req.params.id }, req.body);
      return res.status(201).json({
        message: "Sale updated successfully",
        sale: ressales,
      });
    }

    let totalAmount = 0;
    let totalWithDiscount = 0;
    if (paymentType == null) {
      paymentType = "cash";
    }
    let previousOrderedItems = [];
    let previousreceipt = await Sale.findById(req.params.id).populate({
      path: "items",
      populate: {
        path: "product",
      },
    });
    previousreceipt.items.forEach((i) => {
      previousOrderedItems.push({
        id: i.product._id,
        quantity: i.quantity,
      });
    });
    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res
          .status(400)
          .json({ error: `Product with ID ${item.product} not found` });
      }
      if (product.productType == "product") {
        if (product.maxDiscount < item.lineDiscount) {
          return res.status(400).json({
            error: `Discount for ${product.name} cannot be more than ${product.maxDiscount}`,
          });
        }
        if (
          product.minSellingPrice > 0 &&
          item.unitPrice < product.minSellingPrice
        ) {
          return res.status(400).json({
            error: `${product.name} selling price cannot be less than ${product.minSellingPrice}`,
          });
        }

        if (item.unitPrice < product.buyingPrice) {
          return res.status(400).json({
            error: `${product.name} selling price cannot be less than ${product.buyingPrice}`,
          });
        }
      }

      let prevOrdered = previousOrderedItems.filter(
        (p) => p.id == item.product
      );
      if (product.productType == "product") {
        if (prevOrdered.length > 0) {
          let fProduct = prevOrdered[0];
          if (fProduct.quantity > item.quantity) {
            let iqty = fProduct.quantity - item.quantity;
            product.quantity += iqty;
          } else if (fProduct.quantity < item.quantity) {
            let iqty = item.quantity - fProduct.quantity;

            if (product.quantity < iqty) {
              return res.status(400).json({
                error: `Insufficient quantity of product ${product.name}`,
              });
            }
            product.quantity -= iqty;
          }
        }
      }

      totalAmount += item.unitPrice * item.quantity;
      // Calculate the total amount with discount and add it to the overall sale totalWithDiscount
      const itemTotalWithDiscount =
        (item.unitPrice + item.lineDiscount) * item.quantity -
        item.lineDiscount * item.quantity;
      totalWithDiscount += itemTotalWithDiscount;
    }
    if (
      (paymentType === "credit" || paymentType === "wallet") &&
      (customerId == "" || customerId == null)
    ) {
      return res.status(400).json({ error: "you have to select a customer " });
    }



    //update sale receipt
    let updatingData = {
      totalAmount,
      totalWithDiscount,
      shopId,
      items: [],
      customerId: customerId,
      attendantId,
      paymentType,
      totalDiscount,
      payments,
      status,
    };

    let sale = await Sale.findByIdAndUpdate(req.params.id, updatingData, {
      new: true,
    });

    // Reduce the quantity of products and create entries in SaleItem
    for (const item of products) {
      const product = await Product.findById(item.product);
      //check if product was order before
      let prevOrdered = previousOrderedItems.filter(
        (p) => p.id == item.product
      );
      if (product.productType == "product") {
        if (prevOrdered.length > 0) {
          let fProduct = prevOrdered[0];
          if (fProduct.quantity > item.quantity) {
            let iqty = fProduct.quantity - item.quantity;
            product.quantity += iqty;
          } else if (fProduct.quantity < item.quantity) {
            let iqty = item.quantity - fProduct.quantity;
            product.quantity -= iqty;
          }
        }

        await product.save();
      }

      let saleItem = await SaleItem.findOneAndUpdate(
        { sale: req.params.id },
        {
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice, // Assuming the product's price is used as the unit price
          sale: sale._id, // Assign the sale ID to the sale item
          attendantId: attendantId, // Use the attendant ID from the request
          lineDiscount: item.lineDiscount,
          status,
        },
        { new: true }
      ).populate("product");
      sale.items.push(saleItem);
    }
    await sale.save();
    let ressales = await Sale.findById(sale._id)
      .populate("attendantId", "username")
      .populate("shopId", "name")
      .populate("customerId", "name")
      .populate("items.product", "name")
      .populate({
        path: "items",
        populate: {
          path: "product",
        },
      });
    res.status(201).json({
      message: "Sale updated successfully",
      sale: ressales,
    });
  } catch (error) {
    res.status(400).json({
      error: "Error updating a sale",
    });
  }
};

exports.voidSale = async (req, res) => {
  try {
    const { id } = req.params;

    const receipt = await Sale.findById(id).populate({
      path: "items",
      populate: {
        path: "product",
      },
    });

    if (!receipt) {
      return res.status(404).json({ error: "Sale not found" });
    }

    const promises = receipt.items.map(async (i) => {
      const qty = Number(i.quantity) || 0;

      // inventory restore
      await Inventory.updateOne(
        {
          product: i.product._id || i.product,
          shop: i.shopId,
        },
        [
          {
            $set: {
              quantity: {
                $add: [{ $ifNull: ["$quantity", 0] }, qty],
              },
            },
          },
        ]
      );

      const product = await Product.findById(i.product._id || i.product);

      if (product?.productType === "product" && qty > 0) {
        product.quantity = (Number(product.quantity) || 0) + qty;
        await product.save();
      }
    });

    await Promise.all(promises);

    // do this once, not once per item
    if (receipt.customerId && receipt.paymentType === "credit") {
      await Customer.findByIdAndUpdate(receipt.customerId, {
        $inc: {
          wallet: Number(receipt.outstandingBalance) || 0,
        },
      });
    }

    await saleitem.deleteMany({ sale: id });
    await Sale.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Sale voided successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      error: "Error voiding sale",
    });
  }
};
exports.getonlineSale = async (req, res) => {
  try {
    let { shop, page = 1, limit = 20, fromDate, toDate, status = 'all' } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    if (!shop) {
      return res.status(400).json({ error: "shop is required" });
    }

    const skip = (page - 1) * limit;
    let filter = {};
    if (status != "all") {
      filter.status = status;
    }

    if (shop) {
      filter.shop = shop;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate({
          path: "items",
          populate: {
            path: "product",
            select: "name quantity",
          },
        })
        .populate("customer")
        .populate({ path: "shop", select: "name" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }), // Optional: sorts by creation date, newest first
      Order.countDocuments({ shop }),
    ]);

    res.json({
      data: orders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.onlineSale = async (req, res) => {
  // try {
  let { items, customer, adminId, shopId } = req.body;
  const customerResponse = await Customer.find({
    email: customer.email,
    shopId,
  });
  let customerId = null;
  if (customerResponse.length == 0) {
    let customerres = new Customer({
      name: customer.name,
      phonenumber: customer.phone,
      email: customer.email,
      shopId,
    });
    await customerres.save();
    customerId = customerres._id;
  } else {
    customerId = customerResponse[0]._id;
  }
  // Create order items and collect their ObjectIds
  const orderItemIds = [];
  for (const item of items) {
    const { productId, quantity, sellingPrice } = item;

    const orderItem = new OrderItem({
      product: productId,
      quantity,
      sellingPrice,
    });

    await orderItem.save();
    orderItemIds.push(orderItem._id);
  }

  // Create the order
  const order = new Order({
    items: orderItemIds,
    shop: shopId,
    customer: customerId || null,
  });

  await order.save();

  shopOwnerOrderEmail(req.body);
  customerOrderEmail(req.body);

  res.status(201).json({
    message: "Order created successfully",
    orderId: order._id,
    receiptNo: order.receiptNo,
  });
  // } catch (err) {
  //   res.status(500).json({ message: err.message || "Internal server error" });
  // }
};

exports.createSale = async (req, res) => {
  // try {
    let {
      products,
      shopId,
      customerId,
      attendantId,
      paymentType,
      saleType = "Retail",
      totalDiscount,
      payments,
      status,
      amountPaid,
      totaltax = 0,
      duedate = "",
      salesnote = "",
      customerdata = "",
      online = false,
      orderId,
      createdAt,
      mpesaTotal = 0,
      bankTotal = 0,
      paymentTag = "cash",
      allownegativeselling = false,
      batchTrack = false,
      outstandingBalance,
      saleDiscount = 0,
      extraCharges = [],
      extraChargesTotal = 0,
      mpesaTransId = "",
    } = req.body;


    if (saleType === "WholeSale") saleType = "Wholesale";

    // Validate split payment
    if (paymentTag === "split" && outstandingBalance > 0) {
      return res.status(400).json({
        error: `Split payment must be paid in full, balance is KES ${outstandingBalance}`
      });
    }

    // Create customer if needed
    if (orderId && !customerId) {
      const existing = await Customer.findOne({ email: customerdata.email });
      if (!existing) {
        const c = await Customer.create({
          name: customerdata.name,
          phonenumber: customerdata.phonenumber,
          email: customerdata.email,
        });
        customerId = c._id;
      } else {
        customerId = existing._id;
      }
    }

    paymentType = paymentType || "cash";

    // ----------------------------------------
    // 1️⃣ LOAD ALL PRODUCTS IN ONE QUERY
    // ----------------------------------------
    const productIds = products.map((p) => p.product);
    const dbProducts = await Product.find({ _id: { $in: productIds } }).populate("shopId", "mpesa_require_validation").lean();

    // Load inventory for this shop
    const inventories = await Inventory.find({
      product: { $in: productIds },
      shop: shopId
    }).lean();


    const productMap = {};
    dbProducts.forEach((p) => (productMap[p._id.toString()] = p));

    const inventoryMap = {};
    inventories.forEach(i => inventoryMap[i.product.toString()] = i);

    let totalAmount = 0;          // gross (no discounts)
    let totalWithDiscount = 0;   // net (after discounts)
    let customer;

    for (const item of products) {
      const product = productMap[item.product];
      if (!product) {
        return res.status(400).json({ error: "Product not found" });
      }

      if (product.productType === "product") {
        if (product.maxDiscount < item.lineDiscount) {
          return res.status(400).json({
            error: `Discount for ${product.name} cannot exceed ${product.maxDiscount}`,
          });
        }

        if (
          product.minSellingPrice > 0 &&
          item.unitPrice < product.minSellingPrice
        ) {
          return res.status(400).json({
            error: `${product.name} selling price cannot be less than ${product.minSellingPrice}`,
          });
        }

        if (
          item.unitPrice < product.buyingPrice &&
          !product.manageByPrice
        ) {
          return res.status(400).json({
            error: `${product.name} selling price cannot be less than ${product.buyingPrice}`,
          });
        }

        if (
          product.productType === "product" &&
          !allownegativeselling
        ) {
          const inventory = inventoryMap[item.product];

          let activeInventory = inventory;

          // INVENTORY MISSING
          if (!activeInventory) {

            console.log(
              `AUTO CREATE INVENTORY | ${product.name}`
            );

           try {

              activeInventory =
                await Inventory.findOneAndUpdate(

                  {
                    product: product._id,
                    shop: shopId
                  },

                  {
                    $setOnInsert: {

                      quantity:
                        product.quantity,

                      lastCount:
                        product.quantity,

                      reorderLevel:
                        product.reorderLevel || 0,

                      product:
                        product._id,

                      shop:
                        shopId,

                      attendant:
                        product.attendantId,

                      expiryDate:
                        product.expiryDate || null,

                      barcode:
                        product.barcode || null
                    }
                  },

                  {
                    upsert: true,
                    new: true
                  }
                );

            } catch (err) {

              // duplicate created by another request
              if (err.code === 11000) {

                activeInventory =
                  await Inventory.findOne({
                    product: product._id,
                    shop: shopId
                  });

              } else {

                
              }
            }
            // update memory map
            inventoryMap[item.product] =
              activeInventory;
          }

          // INVENTORY BROKEN
          if (
            activeInventory.quantity <= 0 &&
            product.quantity > 0
          ) {

            console.log(
              `SELF HEAL | ${product.name} | ` +
              `${activeInventory.quantity} -> ${product.quantity}`
            );

            await Inventory.updateOne(
              {
                _id: activeInventory._id
              },
              {
                $set: {
                  quantity: product.quantity
                }
              }
            );

            activeInventory.quantity =
              product.quantity;
          }

          if(activeInventory.quantity < item.quantity) {
            return res.status(400).json({
              error: `Insufficient stock for ${product.name}`
            });
          }
        }

      }

      const lineTotal = item.unitPrice * item.quantity;
      const lineNet = lineTotal - item.lineDiscount;

      totalAmount += lineTotal;
      totalWithDiscount += lineNet;
    }

    const parsedExtraChargesTotal =
      Number(extraChargesTotal || 0);

    totalWithDiscount =
      totalWithDiscount -
      saleDiscount +
      parsedExtraChargesTotal;


    // ----------------------------------------
    // 3️⃣ WALLET / CREDIT LOGIC
    // ----------------------------------------
    if ((paymentType === "credit" || paymentType === "wallet") && !customerId) {
      return res.status(400).json({ error: "Select a customer" });
    }

    if (paymentType === "wallet") {
      customer = await Customer.findById(customerId);
      if (!customer || customer.wallet < totalWithDiscount) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }
      customer.wallet -= totalWithDiscount;
      await customer.save();

      await UserPayment.create({
        type: "payment",
        shopId,
        customerId,
        attendantId,
        totalAmount: totalWithDiscount,
        balance: customer.wallet,
      });
    }
    let saleOutstandingBalance = outstandingBalance;
    if (paymentType === "credit" || (status === "hold" && customerId)) {
      customer = await Customer.findById(customerId);
      const grandtotal = totaltax + totalWithDiscount - amountPaid;
      saleOutstandingBalance = outstandingBalance;
      outstandingBalance -= customer.wallet;
      customer.wallet -= grandtotal;
      await customer.save();

      await UserPayment.create({
        type: "withdraw",
        shopId,
        customerId,
        attendantId,
        totalAmount: totalWithDiscount,
        balance: customer.wallet,
      });
    }

    // ----------------------------------------
    // 4️⃣ CREATE SALE
    // ----------------------------------------
    if (paymentTag === "mpesa" && paymentType != "mpesa") {
      mpesaTotal = totaltax + totalWithDiscount;
      paymentType = "mpesa";
    }
    const sale = await Sale.create({
      totalAmount,
      totalWithDiscount: totaltax + totalWithDiscount,
      products,
      duedate: duedate ? new Date(duedate) : null,
      shopId,
      order: online ? "pending" : null,
      totaltax,
      saleType: online ? "Order" : saleType,
      customerId,
      attendantId,
      amountPaid,
      paymentType,
      totalDiscount: saleDiscount + totalDiscount,
      salesnote,
      payments,
      status,
      createdAt,
      mpesaNewTotal: mpesaTotal,
      bankTotal,
      paymentTag,
      outstandingBalance,
      saleDiscount,
      orderId,
      extraCharges,
      extraChargesTotal,
    });
    if (mpesaTransId && (paymentTag === "mpesa" || paymentTag === "split") && (dbProducts.length > 0 && dbProducts[0]?.shopId?.mpesa_require_validation == true)) {
      const codes = mpesaTransId
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      const allocatedRefs = [];
      for (const code of codes) {
        const payment = await allocatePayment({
          code,
          shopId,
          saleId: sale._id,
        });
        if (payment) {
          allocatedRefs.push(code);
        } else {
          // Not found, wrong shop, or already used by another sale.
          console.warn(`M-Pesa code not allocated: ${code} (sale ${sale._id})`);
        }
      }
      sale.mpesaCode = allocatedRefs.join(",");
      await sale.save();
    }

    // ----------------------------------------
    // 5️⃣ BULK PRODUCT & INVENTORY UPDATES
    // ----------------------------------------
    const productBulk = [];
    const inventoryBulk = [];

    for (const item of products) {
      const product = productMap[item.product];
      const inventory = inventoryMap[item.product];
      const qty = product.manageByPrice ? item.unitPrice / product.sellingPrice : item.quantity;

      if (product.productType === "product") {
        if (product?.quantity > 0) {
          productBulk.push({
            updateOne: {
              filter: { _id: item.product },
              update: { $inc: { quantity: -qty } },
            },
          });
        }
        if (inventory?.quantity > 0) {
          inventoryBulk.push({
            updateOne: {
              filter: { product: item.product, shop: shopId },
              update: { $inc: { quantity: -qty } },
            },
          });
        }
      }
    }

    await Promise.all([
      Product.bulkWrite(productBulk),
      Inventory.bulkWrite(inventoryBulk),
    ]);

    // ----------------------------------------
    // 6️⃣ BULK INSERT SALE ITEMS
    // ----------------------------------------
    const saleItemDocs = products.map((item) => {
      const product = productMap[item.product];

      const qty = product.manageByPrice
        ? item.unitPrice / product.sellingPrice
        : item.quantity;

      return {
        shopId,
        product: item.product,
        tax: item.tax,
        quantity: qty,
        saleType,
        unitPrice: item.unitPrice,
        unitBuyingPrice: product.buyingPrice,
        sale: sale._id,
        attendantId,
        lineDiscount: item.lineDiscount,
        status,
        manageByPrice: product.manageByPrice,
        salesnote,
        createdAt,
        paymentTag,
      };
    });

    let saleItems = await SaleItem.insertMany(saleItemDocs);
    saleItems = await SaleItem.populate(saleItems, {
      path: "product",
    });

    // Attach back to sale document
    sale.items = saleItems.map((item) => item._id);
    await sale.populate(["attendantId", "customerId",
      {
        path: "shopId",
        populate: {
          path: "shopCategoryId",
        },
      },]);

    if (paymentType === "credit" && amountPaid > 0 && customerId) {
      await UserPayment.create({
        type: "payment",
        shopId,
        customerId,
        attendantId,
        totalAmount: amountPaid,
        balance: customer.wallet,
      });
      sale.payments.push({
        amount: amountPaid,
        attendantId,
        paymentNo: `REC${Date.now()}`,
        balance: outstandingBalance,
        paymentType: "cash",
      });
    }
    await sale.save();
    // await sale.save();
    let saleObj = sale.toObject();
    saleObj.items = saleItems;
    res.status(201).json({
      message: "Sale created successfully",
      success: true,
      sale: saleObj,
    });
    let template = "";
    if (sale?.shopId?.shopCategoryId?.name == 'Laundry') {
      let due_date = req.body.ready_date == "" || req.body.ready_date == null ? 'shortly' : `by ${duedate ? new Date(duedate).toDateString() : req.body.ready_date}`;
      let payment_instructions = '';
      if (saleOutstandingBalance > 0 && sale?.shopId?.paybill) {
        payment_instructions = sale?.shopId?.paybill ? `pay via Paybill ${sale?.shopId?.paybill} , Acc: Your Name` : "";
      }
      template = `{shop}: Hi {name}, your order {receipt} has been received and it will be ready ${due_date}, balance Ksh ${saleOutstandingBalance} ${payment_instructions} View receipt: {receipt_url}`;

    }
    sendSaleSmsAfterSale({
      sale,
      template
    })

  // } catch (error) {
  //   console.error("Sale error:", error);
  //   res.status(500).json({ error: "Error when selling" });
  // }
};

function customerOrderEmail(ressales) {
  let items = [];
  ressales.items.forEach((item) => {
    items.push(
      '<tr><td style="padding: 10px; border-bottom: 1px solid #ddd;">' +
      item.name +
      '</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">' +
      item.quantity +
      '</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">' +
      ressales.currency +
      "" +
      item.quantity * item.sellingPrice +
      "</td></tr>"
    );
  });
  const replacements = {
    username: ressales.customer.name,
    items,
    orderid: ressales.receiptNo,
    status: "pending",
    shopName: ressales.shopname,
    shopEmail: ressales.shopemail,
    shopPhone: ressales.shopphone,
    customerName: ressales.customer.name,
  };
  sendEmail(
    ressales.customer.email,
    "New Order!",
    "newordercustomer",
    replacements
  );
}

function shopOwnerOrderEmail(ressales) {
  let items = [];
  ressales.items.forEach((item) => {
    items.push(
      '<tr><td style="padding: 10px; border-bottom: 1px solid #ddd;">' +
      item.name +
      '</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">' +
      item.quantity +
      '</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">' +
      ressales.currency +
      "" +
      item.quantity * item.sellingPrice +
      "</td></tr>"
    );
  });
  const replacements = {
    username: ressales.customer.name,
    items,
    orderid: ressales.receiptNo,
    status: "pending",
    shopName: ressales.shopname,
    customerName: ressales.customer.name,
    customerEmail: ressales.customer.email,
    customerPhone: ressales.customer.phone,
  };
  sendEmail(ressales.shopemail, "New Order!", "neworder", replacements);
}
exports.getShopSales = async (req, res) => {
  try {
    const {
      shopId,
      attendantId,
      customerId,
      paymentType,
      start,
      end,
      duedate,
      status = "cashed",
      order,
      affliate,
      limit = 10, // default limit value (you can adjust it)
      page = 1, // default page value (you can adjust it)
    } = req.query;
    let filter = {
      totalWithDiscount: { $gt: 0 },
      status,
    };
    if (start && end) {
      filter.createdAt = {
        $gte: fromDateFormat(start),
        $lte: toDateFormat(end),
      };
    }
    if (order) {
      if (order == "all") {
        filter.order = { $ne: null };
      } else {
        filter.order = order;
      }
    } else {
      if (status) {
        filter.status = status;
      }
    }
    if (duedate) {
      filter.duedate = {
        $gte: fromDateFormat(start),
        $lte: toDateFormat(end),
      };
      filter.outstandingBalance = {
        $gt: 0,
      };
      // filter.status = 'cashed';
    }
    if (affliate) {
      let shopIds = await Shop.find({ affliate: affliate });
      filter.shopId = { $in: [shopIds] };
    }
    if (attendantId) {
      filter.attendantId = attendantId;
    }

    if (customerId) {
      filter.customerId = customerId;
    }
    if (paymentType && paymentType != null) {
      filter.paymentType = paymentType;
    }

    const sales = await Sale.find(filter)
      .populate("attendantId", "username")
      .populate("shopId", "name")
      .populate({
        path: "shopId",
        populate: {
          path: "adminId",
          select: "username email phone",
        },
      })
      .populate("customerId", "name wallet customerNo")
      .populate("items.product", "name")
      .populate({
        path: "items",
        populate: {
          path: "product",
          select: "name buyingPrice quantity sellingPrice",
        },
      })
      .sort({ createdAt: -1 });
    res.status(200).json({ sales });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getSales = async (req, res) => {
  try {
    const {
      shopId,
      attendantId,
      customerId,
      paymentType,
      start,
      end,
      duedate,
      status = "",
      paymentTag = "cash",
      order,
      affliate,
      receiptNo,
      page,
      limit,
    } = req.query;

    let filter = {
      totalWithDiscount: { $gt: 0 },
    };

    if (start && end && !duedate) {
      filter.createdAt = {
        $gte: new Date(start).toISOString(),
        $lte: new Date(
          new Date(end).setUTCHours(23, 59, 59, 999)
        ).toISOString(),
      };
    }

    if (order) {
      if (order == "all") {
        filter.order = { $ne: null };
      } else {
        filter.order = order;
      }
    } else {
      if (status) {
        filter.status = status;
      }
    }

    if (duedate) {
      filter.duedate = {
        $gte: new Date(start).toISOString(),
        $lte: new Date(
          new Date(end).setUTCHours(23, 59, 59, 999)
        ).toISOString(),
      };
      filter.outstandingBalance = {
        $gt: 0,
      };
      filter.status = "cashed";
    }

    if (shopId && shopId != "undefined") {
      filter.shopId = shopId;
    }

    if (receiptNo) {
      filter.receiptNo = { $regex: receiptNo, $options: "i" };
    }

    if (affliate) {
      let shopIds = await Shop.find({ affliate: affliate });
      filter.shopId = {
        $in: shopIds.map((shop) => new mongoose.Types.ObjectId(shop?._id)),
      };
    }

    if (attendantId) {
      filter.attendantId = attendantId;
    }

    if (customerId) {
      filter.customerId = customerId;
    }

    if (paymentType && paymentType != null) {
      filter.paymentType = paymentType;
    } else if (paymentTag && paymentTag != null) {
      filter.paymentTag = { $in: [paymentTag, "split"] };
      if (paymentTag == "mpesa") {
        filter.mpesaNewTotal = { $gt: 0 };
      }
      if (paymentTag == "bank") {
        filter.bankTotal = { $gt: 0 };
      }
      if (paymentTag == "cash") {
        filter.amountPaid = { $gt: 0 };
      }
    }
    console.log(filter);

    // Define the base query
    let query = Sale.find(filter)
      .populate("attendantId", "username")
      .populate("shopId", "name")
      .populate({
        path: "shopId",
        populate: {
          path: "adminId",
          select: "username email phone",
        },
      })
      .populate("customerId", "name wallet customerNo")
      .populate("items.product", "name")
      .populate({
        path: "items",
        populate: {
          path: "product",
          select: "name buyingPrice quantity sellingPrice",
        },
      })
      .sort({ createdAt: -1 });

    // Apply pagination if 'page' is passed
    if (page) {
      const pageInt = parseInt(page);
      const limitInt = parseInt(limit) || 10;
      const skip = (pageInt - 1) * limitInt;

      query = query.skip(skip).limit(limitInt);
    }

    let sales = await query;
    sales = sales.map((sale) => {
      let totalPayments = 0;
      if (sale.payments && sale.payments.length > 0) {
        totalPayments = sale.payments.reduce((total, payment) => {
          return total + payment.amount;
        }, 0);
      }

      sale.outstandingBalance =
        sale.paymentType === "credit"
          ? sale.totalWithDiscount - totalPayments
          : 0;

      return sale;
    });
    if (page) {
      // Get total count for pagination
      const totalSales = await Sale.countDocuments(filter);
      const totalPages = Math.ceil(totalSales / (parseInt(limit) || 10));

      res.status(200).json({
        data: sales,
        count: totalSales,
        totalPages,
        currentPage: parseInt(page),
      });
    } else {
      res.status(200).json({ sales });
    }
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getproductSales = async (req, res) => {
  try {
    const { attendantId, startDate, endDate, product, shop, receipt } =
      req.query;
    let filter = {
      status: "cashed",
    };
    if (startDate && endDate) {
      new Date(startDate).setUTCHours(23, 59, 59, 999);
      new Date(endDate).setHours(0, 0, 0, 0);
      filter.createdAt = {
        $gte: new Date(startDate).setHours(0, 0, 0, 0),
        $lte: new Date(endDate).setUTCHours(23, 59, 59, 999),
      };
    }

    if (attendantId) {
      filter.attendantId = attendantId;
    }
    if (product) {
      filter.product = product;
    }
    if (shop) {
      filter.shopId = shop;
    }

    // Use Mongoose to find sales matching the filter and populate the referenced fields
    const sales = await SaleItem.find(filter)
      .populate("attendantId", "username")
      .populate("sale", "receiptNo")
      .populate("product", "name buyingPrice, sellingPrice")
      .sort({ createdAt: -1 });

    res.status(200).json({ sales });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
exports.calculateTotalSalesAndProfitByDates = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Convert the startDate and endDate to JavaScript Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check if the startDate and endDate are valid dates
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    end.setUTCHours(23, 59, 59, 999); // Set it to the end of the day

    // Define a filter object to query sales within the date range
    const filter = {
      createdAt: {
        $gte: start,
        $lte: end,
      },
    };

    // Use Mongoose to find sales matching the date range and populate the "items" field with the associated "Product" data
    let response = await totalSalesCalculations(filter);

    res.status(200).json(response);
  } catch (error) {
    console.error("Error calculating total sales and profit:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.groupSalesByMonth = async (req, res) => {
  const { product, startDate, endDate, shopId } = req.query;
  try {
    let matchQuery = {
      product: new mongoose.Types.ObjectId(product),
      createdAt: {
        $gte: new Date(startDate),
        $lt: new Date(endDate),
      },
      status: "cashed",
    };
    if (shopId) {
      matchQuery.shopId = new mongoose.Types.ObjectId(shopId);
    }
    console.log(matchQuery);

    const result = await saleitem.aggregate([
      {
        $match: matchQuery,
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalSales: {
            $sum: {
              $subtract: [
                { $multiply: ["$unitPrice", "$quantity"] },
                "$lineDiscount",
              ],
            },
          },
          count: { $sum: 1 }, // Count the number of sale items
          totalQuantity: { $sum: "$quantity" }, // Sum the total quantity
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Create an object to store sales data for each month
    const salesByMonth = {};

    // Iterate through the result and populate the salesByMonth object
    result.forEach((item) => {
      const monthName = new Date(
        item._id.year,
        item._id.month - 1
      ).toLocaleString("en-US", { month: "long" });
      salesByMonth[monthName] = {
        sales: item.totalSales,
        count: item.count,
        quantity: item.totalQuantity,
      };
    });

    // Ensure all months are present in the final result, even if sales are 0
    const allMonths = [...Array(12).keys()].map((month) => {
      const monthName = new Date(2000, month, 1).toLocaleString("en-US", {
        month: "long",
      });
      return {
        month: monthName,
        sales: salesByMonth[monthName] ? salesByMonth[monthName].sales : 0,
        count: salesByMonth[monthName] ? salesByMonth[monthName].count : 0,
        totalQuantity: salesByMonth[monthName]
          ? salesByMonth[monthName].quantity
          : 0,
      };
    });

    res.status(200).json(allMonths);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getMostSellingProducts = async (req, res) => {
  try {
    const { startDate, endDate, shopId, attendantId } = req.query;
    const matchQuery = {
      createdAt: {
        $gte: new Date(startDate),
        $lt: toDateFormat(endDate),
      },
      status: "cashed",
      shopId: new mongoose.Types.ObjectId(shopId),
    };

    if (attendantId != "") {
      const result = await SaleItem.aggregate([
        {
          $match: matchQuery,
        },
        {
          $project: {
            _id: 1,
            attendantId: 1,
            saleTotal: { $multiply: ["$quantity", "$unitPrice"] },
          },
        },
        {
          $group: {
            _id: "$attendantId",
            totalSales: { $sum: "$saleTotal" },
          },
        },
        {
          $lookup: {
            from: "attendants",
            localField: "_id",
            foreignField: "_id",
            as: "attendant",
          },
        },
        {
          $unwind: "$attendant",
        },
        {
          $project: {
            _id: 1,
            attendantName: "$attendant.username",
            totalSales: 1,
          },
        },
      ]);

      return res.json(result);
    } else {
      const mostSellingProducts = await SaleItem.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$product",
            totalQuantity: { $sum: "$quantity" },
          },
        },
        {
          $sort: { totalQuantity: -1 },
        },
        {
          $limit: 10,
        },
        {
          $lookup: {
            from: "products",
            let: {
              productId: "$_id",
              saleShopId: new mongoose.Types.ObjectId(shopId),
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$_id", "$$productId"] },
                      { $eq: ["$shopId", "$$saleShopId"] },
                    ],
                  },
                },
              },
            ],
            as: "productDetails",
          },
        },
        {
          $unwind: "$productDetails",
        },
        {
          $project: {
            _id: 0,
            product: "$productDetails.name",
            totalQuantity: 1,
          },
        },
      ]);

      res.status(200).json(mostSellingProducts);
    }
  } catch (error) {
    console.error("Error fetching most selling products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


exports.getSingleSale = async (req, res) => {
  let { id } = req.params;
  let sale = await Sale.findById(id)
    .populate("attendantId", "username")
    .populate("shopId", "name")
    .populate({
      path: "shopId",
      populate: {
        path: "adminId",
        select: "username email phone",
      },
    })
    .populate("customerId", "name wallet customerNo")
    .populate("items.product", "name")
    .populate({
      path: "items",
      populate: {
        path: "product",
        select: "name buyingPrice quantity sellingPrice",
      },
    });
  sale.outstandingBalance = sale.totalAmount - calculateTotalPayments(sale);
  res.status(200).json(sale);
};
const calculateTotalPayments = (sale) => {
  let totalPayments = 0;

  if (sale.payments && sale.payments.length > 0) {
    sale.payments.forEach((payment) => {
      totalPayments += payment.amount;
    });
  }

  return totalPayments;
};
// SALES REPORT
// total cash sales
// total credit sales
// returned sales total

exports.getSalesSummary = async (req, res) => {
  try {
    const { fromDate, toDate, shopid, attendantId } = req.query;

    const match = { shopId: new mongoose.Types.ObjectId(shopid) };

    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) match.createdAt.$gte = fromDateFormat(fromDate);
      if (toDate) match.createdAt.$lte = toDateFormat(toDate);
    }
    if (attendantId) match.attendantId = attendantId;

    // ONE aggregation instead of 7 against Sale
    const [salesAgg, refundAgg] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,

            // cash payment type
            cashType_total: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "cash"] }, { $eq: ["$status", "cashed"] }] }, "$totalWithDiscount", 0] } },
            cashType_mpesa: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "cash"] }, { $eq: ["$status", "cashed"] }] }, "$mpesaNewTotal", 0] } },
            cashType_bank: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "cash"] }, { $eq: ["$status", "cashed"] }] }, "$bankTotal", 0] } },

            // split payment type
            split_totalAmount: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "split"] }, { $eq: ["$status", "cashed"] }] }, "$totalAmount", 0] } },
            split_mpesa: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "split"] }, { $eq: ["$status", "cashed"] }] }, "$mpesaNewTotal", 0] } },
            split_bank: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "split"] }, { $eq: ["$status", "cashed"] }] }, "$bankTotal", 0] } },
            split_discounted: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "split"] }, { $eq: ["$status", "cashed"] }] }, "$totalWithDiscount", 0] } },

            // pure mpesa / bank payment types
            mpesaType_total: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "mpesa"] }, { $eq: ["$status", "cashed"] }] }, "$totalAmount", 0] } },
            bankType_total: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "bank"] }, { $eq: ["$status", "cashed"] }] }, "$totalAmount", 0] } },

            // credit
            credit_outstanding: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "credit"] }, { $eq: ["$status", "cashed"] }] }, { $subtract: ["$totalWithDiscount", "$amountPaid"] }, 0] } },
            credit_paid: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "credit"] }, { $eq: ["$status", "cashed"] }] }, "$amountPaid", 0] } },

            // wallet, hold
            wallet_total: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentType", "wallet"] }, { $eq: ["$status", "cashed"] }] }, "$totalWithDiscount", 0] } },
            hold_total: { $sum: { $cond: [{ $eq: ["$status", "hold"] }, "$totalWithDiscount", 0] } },
          },
        },
      ]),
      SaleReturn.aggregate([
        { $match: match },
        { $group: { _id: null, totalRefundAmount: { $sum: "$refundAmount" } } },
      ]),
    ]);

    const s = salesAgg[0] || {};
    const r = refundAgg[0] || {};

    const splitMpesa = s.split_mpesa || 0;
    const splitBank = s.split_bank || 0;
    const splitCash = s.split_totalAmount || 0;
    const StotalDiscounted = s.split_discounted || 0;

    const cashedWithMpesa = s.cashType_mpesa || 0;
    const cashedWithBank = s.cashType_bank || 0;

    const StotalPaid = splitMpesa + splitBank + splitCash;
    const totalCreditSalesTotal = (s.credit_outstanding || 0) + (StotalDiscounted - StotalPaid);

    const totalMpe = (s.mpesaType_total || 0) + cashedWithMpesa + splitMpesa;
    const totalBank = (s.bankType_total || 0) + cashedWithBank + splitBank;

    let totalCashSold = (s.cashType_total || 0) - cashedWithMpesa - cashedWithBank;
    if (!s.cashType_total && s.split_totalAmount) {
      totalCashSold += splitCash;
    }

    const data = {
      cash: totalCashSold + totalMpe + totalBank,
      totalSales: totalCashSold + totalMpe + totalBank,
      cashtransactions: totalCashSold,
      mpesa: totalMpe,
      bank: totalBank,
      debtpaid: s.credit_paid || 0,
      credit: totalCreditSalesTotal,
      wallet: s.wallet_total || 0,
      hold: s.hold_total || 0,
      returns: r.totalRefundAmount || 0,
    };

    res.json(data);
  } catch (error) {
    console.error("Error fetching sales summary:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//get whole products reports
exports.productsSalesReports = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      shop,
      page = 1,
      limit = 100,
      saleType = "Retail",
      product,
    } = req.query;

    const filter = {
      createdAt: {
        $gte: fromDateFormat(fromDate),
        $lte: toDateFormat(toDate),
      },
      saleType,
      shopId: new mongoose.Types.ObjectId(shop), // Assuming shopId is a valid ObjectId
    };
    let productIds = [];
    if (product) {
      const products = await Product.find({ name: new RegExp(product, "i") }); // Case-insensitive search
      productIds = products.map((product) => product._id);
      // Update filter to include product ID filter if needed
      if (productIds.length > 0) {
        filter.product = { $in: productIds };
      }
    }

    // Calculate skip value
    // Calculate skip value
    const skip = (page - 1) * limit;

    // Fetch total count
    const totalCount = await SaleItem.countDocuments(filter);

    // Fetch paginated results with populated fields
    const saleItems = await SaleItem.find(filter)
      .skip(skip)
      .limit(limit)
      .populate("product", "name") // Populate product name
      .populate("attendantId", "username") // Populate attendant name
      .populate("shopId", "name") // Populate attendant name
      .populate(
        "sale",
        "receiptNo bankTotal mpesaTotal mpesaNewTotal amountPaid paymentTag"
      );

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      totalCount,
      totalPages,
      page,
      limit,
      items: saleItems,
    });
  } catch (error) {
    console.log(error);
  }
};

exports.salesDiscountReports = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      shop,
      page = 1,
      limit = 100,
      saleType = "Retail",
      product,
    } = req.query;

    const filter = {
      createdAt: {
        $gte: fromDateFormat(fromDate),
        $lte: toDateFormat(toDate),
      },
      saleType,
      shopId: new mongoose.Types.ObjectId(shop), // Assuming shopId is a valid ObjectId
      lineDiscount: {
        $gt: 0,
      },
    };
    let productIds = [];
    if (product) {
      const products = await Product.find({ name: new RegExp(product, "i") }); // Case-insensitive search
      productIds = products.map((product) => product._id);
      // Update filter to include product ID filter if needed
      if (productIds.length > 0) {
        filter.product = { $in: productIds };
      }
    }

    // Calculate skip value
    // Calculate skip value
    const skip = (page - 1) * limit;

    // Fetch total count
    const totalCount = await SaleItem.countDocuments(filter);

    // Fetch paginated results with populated fields
    const saleItems = await SaleItem.find(filter)
      .skip(skip)
      .limit(limit)
      .populate("product", "name sellingPrice maxDiscount ") // Populate product name
      .populate("attendantId", "username") // Populate attendant name
      .populate("shopId", "name") // Populate attendant name
      .populate(
        "sale",
        "receiptNo bankTotal mpesaTotal mpesaNewTotal amountPaid paymentTag"
      );

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      totalCount,
      totalPages,
      page,
      limit,
      items: saleItems,
    });
  } catch (error) {
    console.log(error);
  }
};

exports.statementRequests = async (req, res) => {
  let { startDate, endDate, shop } = req.query;
  generateSalesReportByDate(startDate, endDate, shop);
  res.json({ message: "Statement request was successful, check your email." });
};

generateSalesReportByDate = async (startDate, endDate, shop) => {
  // Step 1: Fetch sales data between the specified dates
  const sales = await Sale.find({
    createdAt: {
      $gte: new Date(startDate),
      $lt: new Date(endDate),
    },
    shopId: shop,
  }).populate({
    path: "items",
    populate: {
      path: "product", // Populating product data from SaleItem
    },
  });

  // Step 2: Prepare the data for the Excel sheet
  const salesData = [];

  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const product = item.product;
      const remainingStock = product.quantity; // Remaining stock for the product

      salesData.push({
        Product: product.name,
        QuantitySold: item.quantity,
        UnitPrice: item.unitPrice,
        TotalSales: item.unitPrice * item.quantity,
        RemainingStock: remainingStock,
        SaleDate: sale.createdAt.toLocaleDateString(),
      });
    });
  });

  // Step 3: Create an Excel workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(salesData);
  // Step 4: Append worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
  // Step 5: Write the Excel file
  const fileName = `sales_report_${startDate}_to_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
  const attachmentPath = path.join("/var/www/pointify/new-api/", fileName);

  const shopData = await Shop.findById(shop).populate("adminId");
  if (shopData.adminId == null) return;
  let replacements = {
    shopname: shopData.name,
    backup_date: `${startDate} - ${endDate}`,
    username: shopData.adminId.username,
  };
  sendEmail(
    shopData?.backupemail,
    "Pointify Statement",
    "statement",
    replacements,
    [
      {
        filename: fileName,
        path: attachmentPath,
      },
    ]
  );
};

exports.sendreportemail = async (req, res) => {
  let { fromDate, toDate, shop, paymentTag, status, email } = req.query;

  console.log(req.query);
  generateSalesReportByDatePDF(fromDate, toDate, shop, email, paymentTag);
  res.json({ message: "Statement request was successful, check your email." });
};

generateSalesReportByDatePDF = async (
  startDate,
  endDate,
  shop,
  email,
  paymentType
) => {
  let filter = {
    createdAt: {
      $gte: fromDateFormat(startDate),
      $lt: toDateFormat(endDate),
    },
    shopId: shop,
  };
  if (paymentType) {
    filter.paymentType = paymentType;
  }

  console.log(filter);

  const sales = await Sale.find(filter)
    .populate({
      path: "items",
      populate: {
        path: "product",
      },
    })
    .populate("customerId");

  const shopData = await Shop.findById(shop).populate("adminId");
  const salesData = [];
  let total = 0;
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const product = item.product;
      total += item.unitPrice * item.quantity;
      salesData.push({
        Product: product.name,
        Date: sale.createdAt.toLocaleString(),
        Customer: `${sale?.customerId ? sale?.customerId?.name : ""}`,
        Cost: `${shopData.currency}  ${item.unitPrice.toFixed(2)}`,
        Total: `${item.quantity} @ ${shopData.currency} ${(
          item.unitPrice * item.quantity
        ).toFixed(2)}`,
      });
    });
  });

  const pdfDoc = new PDFDocument({ margin: 30, size: "A4" });
  const fileName = `sales_report_${startDate}_to_${endDate}.pdf`;
  const filePath = `/var/www/pointify/new-api/${fileName}`;

  pdfDoc.pipe(fs.createWriteStream(filePath));

  pdfDoc.fontSize(18).text("SALES REPORT", { align: "center" }); // Title centered at the top

  // Center-align shop details
  pdfDoc.fontSize(12);
  const pageWidth =
    pdfDoc.page.width - pdfDoc.page.margins.left - pdfDoc.page.margins.right;

  // Helper function to center-align text
  function drawCenteredText(text, y) {
    const textWidth = pdfDoc.widthOfString(text);
    const xPos = (pageWidth - textWidth) / 2 + pdfDoc.page.margins.left;
    pdfDoc.text(text, xPos, y);
  }

  // Draw centered details
  let currentY = pdfDoc.y + 20; // Leave space below the title
  drawCenteredText(`Shop: ${shopData.name}`, currentY);
  currentY += 15; // Add space between lines
  drawCenteredText(`From: ${startDate} to ${endDate}`, currentY);
  currentY += 15;
  drawCenteredText(`Total: ${shopData.currency} ${total}`, currentY);
  currentY += 15;
  drawCenteredText(`Payment Type: ${paymentType}`, currentY);

  pdfDoc.moveDown(2); // Add space before moving to the table

  const columnWidths = [150, 100, 80, 80, 100]; // Adjusted widths for Product, Date, Cost, Quantity, Total

  drawTableHeader(
    pdfDoc,
    ["Product", "Date", "Customer", "Cost", "Total"],
    columnWidths
  );

  currentY = pdfDoc.y; // Start the first row just below the header

  salesData.forEach((row, index) => {
    // Add a new page if reaching the bottom of the page
    if (currentY > 720) {
      pdfDoc.addPage();
      drawTableHeader(
        pdfDoc,
        ["Product", "Date", "Customer", "Cost", "Total"],
        columnWidths
      );
      currentY = pdfDoc.y; // Reset Y position below the new header
    }

    currentY = drawTableRow(pdfDoc, row, columnWidths, currentY);
  });

  pdfDoc.end();
  if (!shopData.adminId) return;

  let replacements = {
    shopname: shopData.name,
    backup_date: `${startDate} - ${endDate}`,
    username: shopData.adminId.username,
  };

  sendEmail(email, "Sales Report", "statement", replacements, [
    {
      filename: fileName,
      path: filePath,
    },
  ]);
};

function drawTableRow(pdfDoc, row, columnWidths, currentY) {
  pdfDoc.font("Helvetica").fontSize(10);

  let xPos = 50; // Starting X position
  let maxHeight = 0; // Track the maximum height of a cell in the row

  Object.values(row).forEach((value, index) => {
    const textOptions = {
      width: columnWidths[index] - 10, // Slight padding inside the column
      align: "left", // Align numbers to the right
    };

    // Calculate the height of the text to dynamically adjust row height
    const cellHeight = pdfDoc.heightOfString(value, textOptions);
    maxHeight = Math.max(maxHeight, cellHeight);

    // Ensure text fits within the column or truncate if necessary
    const truncatedValue =
      typeof value === "string" && value.length > 50
        ? value.substring(0, 47) + "..."
        : value;

    // Draw the text
    pdfDoc.text(truncatedValue, xPos, currentY, textOptions);
    xPos += columnWidths[index]; // Move to the next column
  });

  // Add a horizontal line below the row for separation
  pdfDoc
    .moveTo(50, currentY + maxHeight + 5)
    .lineTo(550, currentY + maxHeight + 5)
    .stroke();

  return currentY + maxHeight + 10; // Return updated Y position with row height
}

function drawTableHeader(pdfDoc, headers, columnWidths) {
  pdfDoc.font("Helvetica-Bold").fontSize(10);

  let xPos = 50; // Starting X position
  const yPos = pdfDoc.y; // Current Y position for the header

  headers.forEach((header, index) => {
    pdfDoc.text(header, xPos, yPos, {
      width: columnWidths[index] - 10, // Slight padding inside the column
      align: "left", // Align numbers to the right
    });
    xPos += columnWidths[index]; // Move to the next column
  });

  // Add a horizontal line below the header for clarity
  pdfDoc
    .moveTo(50, yPos + 15)
    .lineTo(550, yPos + 15)
    .stroke();

  pdfDoc.moveDown(1); // Add vertical space after the header
}
