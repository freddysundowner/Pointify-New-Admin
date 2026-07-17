
const Sale = require("../models/sales");
const StockRequest = require("../models/stockrequest");
const Inventory = require("../models/inventory")
const BundleItem = require("../models/bundleitem")
const { fromDateFormat, toDateFormat } = require("../shared/validationUtils");
const { Types } = require("mongoose");
const SaleItem = require("../models/saleitem");
const ObjectId = Types.ObjectId;
const Purchase = require("../models/purchase");
const PurchaseItem = require("../models/purchaseitem");
exports.createRequest = async (req, res) => {
  console.log("createRequest")
  let { inventory, attendantId, shopId, warehouse, bundleData} = req.body;
  console.log(req.body);
  try {
    let requestData = await Promise.all(
      inventory.map(async (inventoryData) => {
          return {
            inventory: inventoryData.inventoryId,
            quantity: inventoryData.requestedQty,
            product: inventoryData.product,
          };
        })
      );
      console.log(requestData); 
      const requestRes = new StockRequest({
        requestData,
        attendant: new ObjectId(attendantId),
        fromShop: new ObjectId(shopId),
        warehouse
      });
      let response = await requestRes.save();
    res.json({message: "request made successfully", status:true,response});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creating request" });
  }
};

// Get a stock count entry by ID
exports.getRequestById = async (req, res) => {
  try {
    const stockrequest = await StockRequest.findById(req.params.id);

    if (!stockrequest) {
      return res.status(404).json({ error: "not found" });
    }

    res.status(200).json(stockrequest);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error " });
  }
};

exports.statusOrder = async (req, res) => {
  let { id } = req.params;  
  let { status } = req.body;  
  const result = await StockRequest.findByIdAndUpdate(
      id,
      { status: status },
      { new: true }
  );
   return res.status(200).json({status:true, message:"rejected"});
}
exports.updateRequest = async (req, res) => {
  let { id } = req.params;
  let { productId, quantity, received } = req.body;
  console.log(req.body)
  const result = await StockRequest.updateOne(
    {
      "_id": new ObjectId(id),
      "requestData.product": new ObjectId(productId)
    },
    {
      $set: {
        "requestData.$.quantity": quantity,
        "requestData.$.received": received
      }
    }
  );
   return res.status(200).json({status:true, message:"updated"});
}

exports.deleteRequestItem = async (req, res) => {
    let { id } = req.params;
    let { item } = req.body;
    console.log(id,item)
    const result = await StockRequest.findOneAndUpdate(
        {
          "_id": new ObjectId(id)
        },
        {
          $pull: {
            "requestData": { "_id": new ObjectId(item) }
          }
        },
        {
          new: true // This option ensures the updated document is returned
        }
      );
    console.log(result)
  
    if (!result) {
      return res.status(404).json({ error: "not found" });
    }

    if (result?.requestData?.length == 0) {
      await StockRequest.findByIdAndDelete(result?._id);
    }

    return res.status(200).json(result);
  }

// Delete a stock count entry by ID
exports.deleteRequest= async (req, res) => {
  try {
    const stockrequest = await StockRequest.findByIdAndDelete(req.params.id);

    if (!stockrequest) {
      return res.status(404).json({ error: "not found" });
    }

    res.status(200).json({ message: "deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error deleting stock count" });
  }
};
// Get stock counts by shopId
exports.getRequestByShopId = async (req, res) => {
  try {
    const { from,to, warehouse , status, shop, production ="false"} = req.query;
    let filter = {  };
    if (from) {
      filter.createdAt = {
        $gte: fromDateFormat(from),
        $lte: toDateFormat(to),
      };
    }
    if (status) {
      filter.status = status
    }
    
    if (shop) {
      filter.fromShop = new ObjectId(shop)
    }
    if(production =="true"){
    }else{
      if (warehouse) {
        filter.warehouse = warehouse
      }
    }
    console.log("getRequestByShopId ",filter);
    // Find stock counts that belong to the specified shopId
    const stockCounts = await StockRequest.find(filter)
      .populate({
        path: "attendant",
        select: "username",
      })
      .populate({
        path: "acceptedBy",
        select: "username",
      })
      .populate({
        path: "approvedBy",
        select: "username",
      })
      .populate({
    path: "requestData",
    populate: {
      path: "inventory",
      select: "quantity bundleItems",
      populate: {
        path: "bundleItems",
        populate: {
          path: "item", 
          select: "product",
          populate: {
            path: "product",
            model: "Product",
            select: "name measure",
          },
        },
      },
    },
  })
      .populate({
        path: "fromShop",
        select: "name location address",
      })
      .populate({
        path: "requestData",
        populate: {
          path: "product",
          select: "name quantity buyingPrice sellingPrice measure",
        },
      })
      .sort({ createdAt: -1 });
    // let data = stockCounts.map((request) => {
    //   request.requestData.forEach((req) => {
    //     if (req.inventory && req.inventory.bundleItems) {
    //       req.inventory.bundleItems = req.inventory.bundleItems.map((bundle) => ({
    //         name: bundle.item?.product?.name || "",
    //         quantity: bundle.quantity,
    //       }));
    //     }
    //   });
    //   return request;
    // });
    res.status(200).json(stockCounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error " });
  }
}; 
// Get stock counts by productId
exports.getRequestByProductId = async (req, res) => {
  try {
    const productId = req.params.productId;
    const stockrequests = await StockRequest.find({
      "inventory.product": productId,
    }).populate("attendantId", "username");

    res.status(200).json(stockrequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting stock counts by productId" });
  }
};
exports.acceptOrder = async (req, res) => {
  let { id } = req.params;
  let { attendant} = req.body;
  let {requestData, fromShop, warehouse, attendant:at} = await StockRequest.findOneAndUpdate(
      {
        "_id": new ObjectId(id)
      },
      {
        status : "completed" ,
        acceptedBy: attendant,
        acceptedDate: new Date()
      },
      {
        new: true 
      }
    ).populate("fromShop").populate({
    path: "requestData",
    populate: [
      {
        path: "product",
        select: "name buyingPrice quantity, virtual"
      }
      ,
      {
        path: "inventory",
        populate: {
          path: "bundleItems",
          populate: {
            path: "item", 
            select: "product quantity",
            populate: {
              path: "product",
              model: "Product",
              select: "name buyingPrice",
            },
          },
        }
      }
    ]
  });
     let totalAmount = 0;
  if (requestData) {
      const promises = requestData.map(async (r) => {
        let { product, quantity, received, inventory } = r;
        let addQty = received ? received : quantity;
        totalAmount += product.buyingPrice * addQty;
          console.log("addQty ",addQty,)
          await StockRequest.updateOne(
          {
            "_id": new ObjectId(id),
            "requestData.product": new ObjectId(product?._id)
          },
          {
            $set: {
              "requestData.$.received": addQty
            }
          }
        );


          //check if product was a bundle, increase the bundle items quantities
            let newInvIdPromise = inventory?.bundleItems?.map(async (item) => {
              totalAmount += item?.item?.product?.buyingPrice * (item?.quantity * quantity);
              console.log(item?.quantity * quantity )
              let ires = await Inventory.findOneAndUpdate(
                {
                  shop: new ObjectId(fromShop?._id),
                  product: new ObjectId(item?.item?.product?._id)
                },
                {
                  $inc: { quantity: +(item?.quantity * quantity) },
                  $setOnInsert: {
                    product: new ObjectId(item?.item?.product?._id),
                    shop: new ObjectId(fromShop?._id),
                    attendant: new ObjectId(attendant),
                    status: fromShop?.production ? "raw" : null,
                  }
                },
                { upsert: true, new:true  }
              );
              console.log(item?.quantity )
               let bundleitem = BundleItem({
                item: ires?._id,
                quantity : item?.quantity 
               });
               let savedbundleitem = await bundleitem.save();
               console.log(savedbundleitem)
              return savedbundleitem._id;
              
            })
            const bundleItemIds = await Promise.all(newInvIdPromise);
            console.log("bundleItemIds ",bundleItemIds)
            //add products to the shop that requested
            let inventoryDoc = await Inventory.findOneAndUpdate(
              {
                shop: new ObjectId(fromShop?._id),
                product: new ObjectId(product?._id),
              },
              {
                $inc: { quantity: addQty },
                $set: {
                  product: new ObjectId(product?._id),
                  shop: new ObjectId(fromShop?._id),
                  attendant: new ObjectId(attendant),
                  type: fromShop?.production ? "production" : null,
                  status: fromShop?.production ? "processing" : null,
                },
                $unset: { bundleItems: "" }
              },
              { upsert: true }
            );

            //delete prev bundle items
            if (inventoryDoc?.bundleItems.length > 0) {
              await BundleItem.deleteMany({
                _id: { $in: inventoryDoc.bundleItems.map(id => new ObjectId(id)) }
              });
            }
            if (bundleItemIds.length > 0) {
              await Inventory.updateOne(
                {
                  shop: new ObjectId(fromShop?._id),
                  product: new ObjectId(product?._id),
                },
                {
                  $set: {
                    bundleItems: bundleItemIds
                  }
                },
                { upsert: true }
              );
            }

        
      })
      await Promise.all(promises);


      //create purchase
      const purchase = new Purchase({
        totalAmount,
        shopId: fromShop,
        attendantId: at._id,
        paymentType: 'cash',
      });
      await purchase.save();

    //create purchase item   
    const saleItempromises = requestData.map(async (r) => {
      let { product, quantity, received } = r;
      let addQty = received ? received : quantity;
      const purchaseItem = new PurchaseItem({
        product: product?._id,
        quantity: addQty,
        unitPrice: product?.buyingPrice,
        purchase: purchase._id,
        attendantId: at._id,
        shop: fromShop
      });

      await purchaseItem.save();
      let dataresponse = await purchaseItem.populate("product");
      purchase.items.push(dataresponse);
    });
    await Promise.all(saleItempromises);
    await purchase.save();
  }
  return res.status(200).json({status:true, message:"approved"});
}


exports.approveWareHouseRequests = async (req, res) => {
  let { id } = req.params;
  let { attendant } = req.body;
  let { requestData, fromShop, warehouse, attendant: at } = await StockRequest.findOneAndUpdate(
    {
      "_id": new ObjectId(id)
    },
    {
      status : "processed",
      approvedBy: attendant,
      dispatchedDate: new Date()
    },
    {
      new: true
    }
  ).populate({
    path: "requestData",
    populate: [
      {
        path: "product",
        select: "name buyingPrice quantity, virtual"
      }
      ,
      {
        path: "inventory",
        populate: {
          path: "bundleItems",
          populate: {
            path: "item", 
            select: "product quantity",
            populate: {
              path: "product",
              model: "Product",
              select: "name buyingPrice",
            },
          },
        }
      }
    ]
  });

     let totalAmount = 0;
     let inventoryCheckPassed = true;

  if (requestData) {
        // Check if inventory meets request
      for (const r of requestData) {
        const { product, quantity, inventory } = r;
          if (product?.virtual == false) {
            if (!inventory || inventory.quantity < quantity) {
              inventoryCheckPassed = false;
              return res.status(400).json({
                error: `Insufficient stock for product ${product.name}`,
              });
            }
          }

        if (inventory?.bundleItems?.length > 0) {
          for (const item of inventory.bundleItems) {
            console.log(item, item.quantity * quantity, item.quantity)
            // Check if the item has insufficient quantity
            if (item?.item?.quantity < item.quantity * quantity) {
              inventoryCheckPassed = false;
              return res.status(400).json({ 
                error: `Insufficient stock for ${item?.item?.product.name}, to fulfil ${product.name} bundle`,
              });
            }
          } 
        }

      }
      if (inventoryCheckPassed ==false) { 
        return res.status(500).json({status:false, message:"approved"});
      }
    
      const promises = requestData.map(async (r) => {
        const { product, quantity, inventory } = r;
        //reduce product from warehouse the quantity
          // if the requested product has a quantity, its not a must a bundle to have a quantity
        if (product?.virtual ==false) {
          totalAmount += product.buyingPrice * quantity;
          await Inventory.updateOne(
            {
              shop: new ObjectId(warehouse),
              product: new ObjectId(inventory?.product)
            },
            {
              $inc: { quantity: -quantity },
            },
            { upsert: true }
          );
        }

        //check if product was a bundle, reduce the bundle items quantities
        if (inventory?.bundleItems?.length > 0) {
          inventory?.bundleItems?.map(async (item) => {
            console.log(item,item?.item?.product?.buyingPrice, (item?.quantity * quantity))
            totalAmount += item?.item?.product?.buyingPrice * (item?.quantity * quantity);
            await Inventory.updateOne(
              {
                shop: new ObjectId(warehouse),
                _id: new ObjectId(item?.item)
              },
              {
                $inc: { quantity: -(item?.quantity * quantity) },
              },
              { upsert: true, new: true }
            );
          })
        }
        
      })
      await Promise.all(promises);
    console.log(totalAmount);
      await createSaleEntry(requestData,totalAmount,warehouse,at);
  }
  return res.status(200).json({status:true, message:"approved"});
}


const createSaleEntry = async(requestData,totalAmount,warehouse,at) => {
    const sale = new Sale({
      totalAmount,
      shopId:warehouse,
      attendantId:at?._id,
      amountPaid: totalAmount,
      totalWithDiscount:totalAmount
    });
    await sale.save();
  const saleItempromises = requestData.map(async (r) => {
    let { product, quantity, inventory } = r;
    //if its a bundle and bundle is virtual sell items individually
    if (product?.virtual == true && inventory?.bundleItems?.length > 0) {
        inventory?.bundleItems?.map(async (item) => {
          const saleItem = new SaleItem({
            shopId: warehouse,
            product: item?.item?.product?._id,
            quantity: item?.quantity * quantity,
            unitPrice: item?.item?.product?.buyingPrice,
            sale: sale._id,
            attendantId: at?._id,
          });
          await saleItem.save();
          let dataresponse = await saleItem.populate("product");
          sale.items.push(dataresponse);
        })
      
    }
    //if its a bundle and bundle is not virtual sell the bundle
    if (product?.virtual == false) {
      const saleItem = new SaleItem({
        shopId: warehouse,
        product: product?._id,
        quantity,
        unitPrice: product?.buyingPrice,
        sale: sale._id,
        attendantId: at?._id,
      });
      await saleItem.save();
      let dataresponse = await saleItem.populate("product");
      sale.items.push(dataresponse);
    }
  });
  await Promise.all(saleItempromises);
  if (sale?.items?.length > 0 ) {
    await sale.save();
  }
  
}