const ProductCategory = require("../models/productcategory");
const Supplier = require("../models/supplier");
const StockCount = require("../models/count");
const Adjustmet = require("../models/adjustment");
const Purchase = require("../models/purchase");
const SaleItem = require("../models/saleitem");
const BundleItem = require("../models/bundleitem");
const Inventory = require("../models/inventory");
const PurchaseItem = require("../models/purchaseitem");
const saleitem = require("../models/saleitem");
const Activity = require("../models/activities");
const sales = require("../models/sales");
const salereturns = require("../models/salereturns");
const path = require("path");
const transfer = require("../models/transfer");
const badstock = require("../models/badstock");
const Shop = require("../models/shop");
const count = require("../models/count");
const Batch = require("../models/batch");
const XLSX = require("xlsx");
const { sendEmail, sendEmailNew } = require("../shared/emailsetup");

const Product = require("../models/product");
const { Types } = require("mongoose");
const ObjectId = Types.ObjectId;
const { fromDateFormat, toDateFormat } = require("../shared/validationUtils");
const uuid = require("uuid");
const {
    stockreport,
    createNewBatch,
    repairMissingInventories,
} = require("../shared/functions");
const fs = require("fs");

const bulkDelete = async (req, res) => {
    try {
        let { ids, shopId } = req.body;
        console.log(req.body);
        if (shopId) {
            ids = await Product.find({ shopId: shopId }).select("_id");
        }
        let saleitems = await saleitem.find({ product: { $in: ids } });
        await badstock.deleteMany({ productId: { $in: ids } });
        await StockCount.deleteMany({ productId: { $in: ids } });

        await SaleItem.deleteMany({
            _id: { $in: saleitems.map((i) => i._id) },
        });
        await sales.deleteMany({ items: { $in: saleitems.map((i) => i._id) } });
        await salereturns.deleteMany({
            items: { $in: saleitems.map((i) => i._id) },
        });
        await Inventory.deleteMany({ product: { $in: ids } });

        let purchaseitems = await PurchaseItem.find({ product: { $in: ids } });

        await PurchaseItem.deleteMany({
            _id: { $in: purchaseitems.map((i) => i._id) },
        });
        await Purchase.deleteMany({
            items: { $in: purchaseitems.map((i) => i._id) },
        });
        let deleted = await Product.deleteMany({ _id: { $in: ids } });
        res.status(200)
            .setHeader("Content-Type", "application/json")
            .json({ success: true, data: deleted });
    } catch (error) {
        res.status(422)
            .setHeader("Content-Type", "application/json")
            .json({ success: false, message: error + " " });
    }
};

// Function to generate a simple unique product code with a max length of 7 characters
function generateProductCode() {
    // Generate a short random string with a max length of 3 characters
    const randomString = Math.random()
        .toString(36)
        .substring(2, 5)
        .toUpperCase();

    // Generate a unique identifier (UUID)
    const uniqueId = uuid
        .v4()
        .split("-")
        .join("")
        .substring(0, 4)
        .toUpperCase();

    // Combine the random string and unique identifier to create the unique code
    const productCode = randomString + uniqueId;

    // Trim the code to ensure it doesn't exceed 7 characters
    const trimmedProductCode = productCode.substring(0, 7);

    return trimmedProductCode;
}

// Create a new product category
const createProductCategory = async (req, res) => {
    try {
        const { name, admin, shop } = req.body;
        const productCategoryByName = await ProductCategory.find({
            name,
            admin,
            shop,
        });
        if (productCategoryByName.length > 0) {
            return res
                .status(201)
                .json({ error: "category with that name already exists" });
        }
        const productCategory = new ProductCategory({ name, admin, shop });
        await productCategory.save();
        res.status(201).json({ message: "added successfully" });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get all product categories
const getAllProductCategories = async (req, res) => {
    try {
        let { page, limit, admin, shop } = req.query;

        // Convert page and limit to integers and calculate skip if page is provided
        const pageInt = parseInt(page) || 0;
        const limitInt = parseInt(limit) || 10;
        const skip = page ? (pageInt - 1) * limitInt : 0;

        // Define the base query
        let categoriesQuery;

        if (shop) {
            categoriesQuery = ProductCategory.find({ shop });
        } else if (admin) {
            categoriesQuery = ProductCategory.find({ admin });
        } else {
            categoriesQuery = ProductCategory.find();
        }

        // Apply pagination if 'page' is passed
        if (page) {
            categoriesQuery = categoriesQuery.skip(skip).limit(limitInt);
        }

        const productCategories = await categoriesQuery;

        if (page) {
            // Get total count for pagination
            const totalCategories = await ProductCategory.countDocuments();
            const totalPages = Math.ceil(totalCategories / limitInt);

            res.status(200).json({
                data: productCategories,
                count: totalCategories,
                totalPages,
                currentPage: pageInt,
            });
        } else {
            res.status(200).json(productCategories);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Update a product category by ID
const updateProductCategory = async (req, res) => {
    const { id } = req.params;
    try {
        const { name } = req.body;
        const updatedCategory = await ProductCategory.findByIdAndUpdate(
            id,
            { name },
            { new: true },
        );
        if (!updatedCategory) {
            return res
                .status(404)
                .json({ error: "Product category not found" });
        }
        res.status(200).json(updatedCategory);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

// Delete a product category by ID
const deleteProductCategory = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedCategory = await ProductCategory.findByIdAndRemove(id);
        if (!deletedCategory) {
            return res
                .status(404)
                .json({ error: "Product category not found" });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

// Create a new product
const createBundleProduct = async (productData) => {
    try {
        const {
            warehouse,
            admin,
            shopId,
            attendantId,
            items,
            quantity,
            barcode,
        } = productData;
        let existingProduct;
        if (warehouse == "true") {
            existingProduct = await Product.findOne({
                name: productData.name,
                admin: admin,
                deleted: false,
            });
        } else {
            existingProduct = await Product.findOne({
                name: productData.name,
                shopId: productData.shopId,
                deleted: false,
            });
        }

        // productData.barcode = generateProductCode();
        if (existingProduct) {
            return {
                error: `with the same name already exists`,
            };
        }

        //check if shop has allowed batch tracking
        let shopDetails = await Shop.findOne({ _id: productData.shopId });
        let trackBatch = shopDetails?.trackbatches;

        //save bundle items
        let promises = items.map(async (data) => {
            let { quantity, item, itemId } = data;
            let bundleitem = new BundleItem({ quantity, item: itemId });
            const savedItem = await bundleitem.save();
            return savedItem._id;
        });
        const bundleItemIds = await Promise.all(promises);
        const product = new Product(productData);
        await product.save();
        if (warehouse == "false") {
            product.quantity = quantity;
        }
        await createNewBatch(product, trackBatch);
        const newInventory = new Inventory({
            bundleItems: bundleItemIds,
            quantity,
            product: product?._id,
            shop: shopId,
            attendant: attendantId,
        });
        await newInventory.save();
        return product;
    } catch (error) {
        console.log(error);
        return { error: "Internal server error" };
    }
};

// Create a new product
const createProduct = async (req, res) => {
    const productData = req.body;
    const {
        warehouse,
        admin,
        shopId,
        attendantId,
        bundle = "false",
    } = productData;
    if (bundle == true) {
        let product = await createBundleProduct(productData);
        return res.status(201).json(product);
    }
    let quantity = productData.quantity ?? 1;
    productData.quantity = productData.quantity ?? 1;
    req.body.quantity = 0;
    let existingProduct;
    if (warehouse == "true") {
        existingProduct = await Product.findOne({
            name: productData.name,
            shopId: productData.shopId,
            deleted: false,
        });
    } else {
        existingProduct = await Product.findOne({
            name: productData.name,
            shopId: productData.shopId,
            deleted: false,
        });
    }

    let type = productData.productType ?? "";
    if (productData.minSellingPrice != null) {
        productData.minSellingPrice = null;
    }
    if (
        productData.minSellingPrice != null &&
        productData.minSellingPrice < productData.buyingPrice
    ) {
        return res.status(400).json({
            error: `${type} minSellingPrice cannot be less than buying price`,
        });
    }
    //check if shop has allowed batch tracking
    let shopDetails = await Shop.findOne({ _id: productData.shopId });
    let trackBatch = shopDetails?.trackbatches;

    let produtUpdateData = productData;
    const product = new Product(produtUpdateData);
    await product.save();

    if (type == "product") {
        let data = {
            totalAmount: productData.buyingPrice * quantity,
            shopId: productData.shopId,
            supplierId: productData.supplierId,
            attendantId: productData.attendantId,
            paymentType: "cash",
            amountPaid: productData.buyingPrice * quantity,
        };
        await createPurchase(data, product, quantity, productData.shopId);
        if (warehouse == "false") {
            product.quantity = quantity;
        }
        // await createNewBatch(product, trackBatch);
        console.log(quantity);
    }

    const newInventory = new Inventory({
        quantity,
        product,
        shop: shopId,
        attendant: attendantId,
    });
    await newInventory.save();

    res.status(201).json(product);
};

const createPurchase = async (data, product, quantity, shop) => {
    const sale = new Purchase(data);
    await sale.save();
    let purchaseItems = [
        {
            product: product._id,
            quantity: quantity,
            unitPrice: product.buyingPrice,
            attendantId: product.attendantId,
        },
    ];

    for (const item of purchaseItems) {
        const product = await Product.findById(item.product);
        item.quantity = item.quantity ?? 1;
        product.quantity += item.quantity;
        await product.save();

        const saleItem = new PurchaseItem({
            product: item.product,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            purchase: sale._id,
            attendantId: item.attendantId,
            shop: shop,
        });

        await saleItem.save();
        let dataresponse = await saleItem.populate("product");
        sale.items.push(dataresponse);
    }
    await sale.save();
};

const applyPagination = (query, page, limit) => {
    if (page) {
        const skip = (page - 1) * limit;
        return query.skip(skip).limit(limit);
    }
    return query;
};

const getProducts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 15,
            name,
            shop,
            shopid,
            barcode,
            expiryDate,
            supplier,
        } = req.query;

        let filter = {};

        if (name) {
            filter.name = { $regex: name, $options: "i" };
        }

        if (shop) {
            const shops = await Shop.find({
                name: { $regex: shop, $options: "i" },
            }).select("_id");
            const shopIds = shops.map((s) => s._id);
            if (shopIds.length > 0) {
                filter.shopId = { $in: shopIds };
            } else {
                // No match → force empty results
                filter.shop = { $in: [] };
            }
        }
        if (shopid) {
            filter.shopId = shopid;
        }

        if (barcode) {
            filter.barcode = barcode;
        }

        if (expiryDate) {
            filter.expiryDate = expiryDate;
        }

        if (supplier) {
            const supplierRes = await Supplier.findOne({
                name: { $regex: supplier, $options: "i" },
            });
            if (supplierRes) filter.supplierId = supplierRes._id;
        }
        console.log(filter);

        // Count total documents
        const totalDoc = await Product.countDocuments(filter);

        // Get paginated products
        const products = await Product.find(filter)
            .populate("shopId", "name")
            .populate("supplierId", "name")
            .populate("attendantId", "username")
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit))
            .sort({ date: -1 });

        return res.status(200).json({
            data: products,
            totalDoc,
            limits: Number(limit),
            pages: Math.ceil(totalDoc / limit),
        });
    } catch (error) {
        return res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};

const getAllProducts = async (req, res) => {
    try {
        let {
            name,
            useWarehouse = "false",
            production = false,
            warehouse = "false",
            productType,
            shopid,
            type,
            sort,
            productid,
            categoryId,
            barcodeid,
            page,
            limit,
            reason = "all",
            date,
            filter,
            ca,
        } = req.query;

        const query = {};

        // Handle ID-based filters
        if (productid) query._id = productid;
        if (barcodeid) query.barcode = barcodeid;

        // Warehouse/shop logic
        const useWarehouseFlag =
            warehouse === "true" || useWarehouse === "true";
        if (shopid) {
            if (useWarehouseFlag) query.shop = new ObjectId(shopid);
            else query.shopId = new ObjectId(shopid);
        }
        if (filter === "excludeoutofstock") {
            query.quantity = { $gt: 0 };
        }

        if (categoryId) query.productCategoryId = categoryId;

        // Type and production filtering
        if (production === true || production === "true") {
            query.type = req.query.raw === "true" ? "raw" : "production";
        }
        if (productType) {
            query.$or = [{ productType }, { productType: { $exists: false } }];
        }
        if (type === "fastmoving") {
            const days = 30;

            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);

            const stats = await SaleItem.aggregate([
                {
                    $match: {
                        shopId: new ObjectId(shopid),
                        createdAt: { $gte: fromDate },
                        status: { $ne: "cancelled" },
                    },
                },
                {
                    $group: {
                        _id: "$product",
                        totalSoldQty: { $sum: "$quantity" },
                        salesCount: { $sum: 1 },
                    },
                },
                {
                    $sort: {
                        salesCount: -1,
                        totalSoldQty: -1,
                    },
                },
            ]);

            const productIds = stats.map((item) => item._id);

            if (!productIds.length) {
                return res.status(200).json({
                    data: [],
                    count: 0,
                    totalPages: 0,
                    currentPage: 1,
                });
            }

            let productQuery = Product.find({
                _id: { $in: productIds },
                shopId: new ObjectId(shopid),
            });

            const products = await populateProductFields(productQuery);

            const statsMap = new Map(
                stats.map((item) => [
                    String(item._id),
                    {
                        totalSoldQty: item.totalSoldQty,
                        salesCount: item.salesCount,
                    },
                ]),
            );

            const orderedProducts = stats
                .map((item) => {
                    const product = products.find(
                        (p) => String(p._id) === String(item._id),
                    );
                    if (!product) return null;

                    return {
                        ...(product.toObject?.() ?? product),
                        ...statsMap.get(String(item._id)),
                    };
                })
                .filter(Boolean);

            // ✅ pagination
            const pageInt = parseInt(page) || 1;
            const limitInt = parseInt(limit) || 10;
            const skip = (pageInt - 1) * limitInt;

            const paginated = orderedProducts.slice(skip, skip + limitInt);

            const totalProducts = orderedProducts.length;
            const totalPages = Math.ceil(totalProducts / limitInt);

            return res.status(200).json({
                data: paginated,
                count: totalProducts,
                totalPages,
                currentPage: pageInt,
            });
        }
        if (type === "dormant") {
            const days = 30;

            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);

            const soldProducts = await SaleItem.distinct("product", {
                shopId: new ObjectId(shopid),
                createdAt: { $gte: fromDate },
                status: { $ne: "cancelled" },
            });

            const pageInt = parseInt(page) || 1;
            const limitInt = parseInt(limit) || 10;
            const skip = (pageInt - 1) * limitInt;

            let productQuery = Product.find({
                shopId: new ObjectId(shopid),
                deleted: false,
                quantity: { $gt: 0 },
                _id: { $nin: soldProducts },
            })
                .sort({ quantity: 1 })
                .skip(skip)
                .limit(limitInt);

            const products = await populateProductFields(productQuery);
            repairMissingInventories(products);
            const totalProducts = await Product.countDocuments({
                shopId: new ObjectId(shopid),
                deleted: false,
                quantity: { $gt: 0 },
                _id: { $nin: soldProducts },
            });

            const totalPages = Math.ceil(totalProducts / limitInt);

            return res.status(200).json({
                data: products,
                count: totalProducts,
                totalPages,
                currentPage: pageInt,
            });
        }
        // Time-based and stock filters
        const currentDate = fromDateFormat(new Date());
        switch (type) {
            case "outofstock":
                query.quantity = {
                    $lte: 0,
                };
                query.productType = {
                    $ne: "service",
                };
                break;
            case "countedtoday":
                query.lastcoundate = {
                    $gte: currentDate,
                    $lte: toDateFormat(new Date()),
                };
                break;
            case "counteddate":
                query.lastcoundate = {
                    $gte: fromDateFormat(date),
                    $lte: toDateFormat(date),
                };
                break;
            case "notcountedtoday":
                query.$or = [
                    { lastcoundate: { $lt: currentDate } },
                    { lastcoundate: { $exists: false } },
                    { lastcoundate: null },
                ];
                break;
            case "nevercounted":
                query.lastcoundate = { $eq: null };
                break;
            case "runninglow":
                query.$expr = {
                    $and: [
                        {
                            $lt: [
                                "$quantity",
                                {
                                    $ifNull: [
                                        "$reorderLevel",
                                        Number.MAX_SAFE_INTEGER,
                                    ],
                                },
                            ],
                        },
                        {
                            $gte: ["$quantity", 0],
                        },
                    ],
                };
                break;
            case "expired":
                query.expiryDate = { $lt: toDateFormat(new Date()) };
                break;
            case "processed":
            case "processing":
            case "raw":
                query.status = type;
                break;
        }

        // Sort logic
        const sortOptions = {};
        switch (sort) {
            case "highestbuying":
                sortOptions.buyingPrice = -1;
                break;
            case "highestselling":
                sortOptions.sellingPrice = -1;
                break;
            case "quantityasc":
                sortOptions.quantity = 1;
                break;
            case "quantity":
                sortOptions.quantity = -1;
                break;
            case "runninglow":
                sortOptions.reorderLevel = -1;
                break;
            case "outofstock":
                query.quantity = 0;
                break;
            case "expirydate":
                sortOptions.expiryDate = 1;
                break;
            default:
                sortOptions.quantity = 1;
            // sortOptions.date = -1;
        }

        const pageInt = parseInt(page) || 0;
        const limitInt = parseInt(limit) || 10;
        const skip = pageInt > 0 ? (pageInt - 1) * limitInt : 0;

        if (useWarehouseFlag) {
            if (name) {
                const matchedProducts = await Product.find({
                    $or: [{ shopId: query?.shop }],
                    $and: [
                        {
                            $or: [
                                { name: { $regex: name, $options: "i" } },
                                {
                                    serialnumber: {
                                        $regex: name,
                                        $options: "i",
                                    },
                                },
                            ],
                        },
                    ],
                });

                query.product = { $in: matchedProducts.map((p) => p?._id) };
            }

            let inventoryQuery = Inventory.find(query)
                .select("quantity status bundle bundleItems")
                .populate([
                    {
                        path: "product",
                        populate: [
                            { path: "measureUnit" },
                            { path: "supplierId" },
                            { path: "productCategoryId" },
                            { path: "batches" },
                            { path: "attendantId" },
                        ],
                    },
                    { path: "shop" },
                    {
                        path: "bundleItems",
                        populate: [
                            {
                                path: "item",
                                select: "product quantity",
                                populate: {
                                    path: "product",
                                    select: "name",
                                },
                            },
                            {
                                path: "item_product",
                                select: "name",
                            },
                        ],
                    },
                ])
                .sort(sortOptions)
                .lean();
            inventoryQuery = applyPagination(inventoryQuery, pageInt, limitInt);
            const rawProducts = await inventoryQuery.exec();
            const products = rawProducts.reduce((acc, item) => {
                if (item.product) {
                    acc.push({
                        ...item.product,
                        quantity: item.quantity,
                        inventoryId: item._id,
                        status: item.status,
                        bundle: item.bundle,
                        bundleItems: item.bundleItems,
                        shopId: item?.shop,
                        barcode: item?.product?.barcode
                            ? String(item?.product?.barcode).length > 7
                                ? String(item?.product?.barcode).substring(0, 7) // take first 7 chars
                                : String(item?.product?.barcode).padStart(
                                      7,
                                      "0",
                                  ) // pad if shorter
                            : null,
                    });
                }
                return acc;
            }, []);
            if (page && reason !== "download") {
                // const totalProducts = await Inventory.countDocuments(query);
                let shopId = query?.shop;
                delete query.shop;
                query.shopId = shopId;
                const totalProducts = await Product.countDocuments(query);
                const totalPages = Math.ceil(totalProducts / limitInt);
                return res.status(200).json({
                    data: products,
                    count: totalProducts,
                    totalPages,
                    currentPage: pageInt,
                });
            }

            return res
                .status(200)
                .json(reason === "download" ? { data: products } : products);
        } else {
            if (name) query.name = { $regex: name, $options: "i" };

            let productQuery = Product.find(query).sort(sortOptions);
            if (page) productQuery = productQuery.skip(skip).limit(limitInt);

            const products = await populateProductFields(productQuery);
            if (page && reason !== "download") {
                const totalProducts = await Product.countDocuments(query);
                const totalPages = Math.ceil(totalProducts / limitInt);
                return res.status(200).json({
                    data: products,
                    count: totalProducts,
                    totalPages,
                    currentPage: pageInt,
                });
            }
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
// A helper function to populate common fields
const populateProductFields = (query) => {
    return query
        .populate("measureUnit")
        .populate("supplierId")
        .populate("productCategoryId")
        .populate("shopId")
        .populate("batches")
        .populate("admin")
        .populate({
            path: "attendantId",
            select: "username",
        })
        .then((products) => {
            if (products.length > 0) {
                products.forEach((product) => {
                    if (Array.isArray(product.images)) {
                        product.images = product.images.filter(
                            (image) => image !== null,
                        );
                    }

                    product.barcode = product?.barcode
                        ? String(product?.barcode).length > 7
                            ? String(product?.barcode).substring(0, 7) // take first 7 chars
                            : String(product?.barcode).padStart(7, "0") // pad if shorter
                        : null;
                });
            }
            return products;
        });
};

const getProductBundleItems = async (req, res) => {
    let { id } = req.params;
    let bundleItems = await BundleItem.find({ product: id }).populate(
        "item_product",
        "name",
    );
    res.json(bundleItems);
};

// Get a product by ID with populated fields
const getProductCategoryById = async (req, res) => {
    const { id } = req.params;
    try {
        const categories = await ProductCategory.findById(id);
        if (!categories) {
            return res.status(404).json({ error: "category not found" });
        }

        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};
// Get a product by ID with populated fields
const getProductById = async (req, res) => {
    const { id } = req.params;
    try {
        const product = await populateProductFields(Product.findById(id));
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

const updateProductBundle = async (productId, data) => {
    let { items, bundle, shop, shopId } = data;
    if (bundle == false) {
        return [];
    }
    console.log(items);
    await Promise.all(
        items?.map(async ({ quantity, item }) => {
            await BundleItem.deleteMany({
                item: item,
                shop: shopId ? shopId : shop,
            });
        }),
    );
    // const product = await Inventory.findOne({
    //   product: productId,
    //   shop : shopId ? shopId : shop,
    // }).populate({
    //   path: "bundleItems",
    //   populate: { path: "item", select: "name" },
    // });
    // console.log(productId,product)

    // if (product) {
    //   if (product.bundleItems.length > 0) {
    if (bundle == false) {
        // await Inventory.updateOne(
        //   { product: productId, shop },
        //   { $set: { bundleItems: [] } }
        // );
        return [];
    }
    // }

    // Create a map of existing bundle items for easy lookup by item ID
    // const existingItemsMap = new Map(
    //   product.bundleItems.map((bundleItem) => [
    //     bundleItem.item?._id.toString(),
    //     bundleItem,
    //   ])
    // );

    // Prepare the updated bundle items list
    const updatedBundleItems = await Promise.all(
        items?.map(async ({ quantity, itemId, item }) => {
            const newBundleItem = new BundleItem({
                quantity,
                item: itemId,
                product: productId,
                item_product: item,
            });
            await newBundleItem.save();
            return newBundleItem._id;
        }),
    );

    // Update the product's bundleItems array with the new list
    console.log(updatedBundleItems);
    return updatedBundleItems;
    // }
};
const removebundleitem = async (req, res) => {
    try {
        let { itemId, productId } = req.query;
        // Step 1: Find the `BundleItem` document by `itemId`
        const bundleItem = await BundleItem.findOne({ _id: itemId });
        if (!bundleItem) {
            throw new Error("Bundle item not found");
        }

        // Step 2: Remove the `bundleItem` reference from the product using `$pull`
        await Inventory.updateOne(
            { _id: productId },
            { $pull: { bundleItems: bundleItem._id } },
        );

        // Step 3: Delete the `BundleItem` document
        await BundleItem.deleteOne({ _id: bundleItem._id });
        return res.status(200).json({
            success: true,
            message: "Bundle item removed successfully",
        });
    } catch (error) {
        console.error(error);
        throw new Error("Failed to remove bundle item");
    }
};
const updateBarcode = async (req, res) => {
    try {
        const { id } = req.params;
        const { barcode } = req.body;

        if (!barcode) {
            return res.status(400).json({
                error: "Barcode is required",
            });
        }

        // check duplicate barcode
        const existing = await Product.exists({
            barcode,
            _id: { $ne: id },
        });

        if (existing) {
            return res.status(400).json({
                error: "Barcode already exists",
            });
        }

        // update product
        const product = await Product.findByIdAndUpdate(
            id,
            {
                $set: { barcode },
            },
            {
                new: true,
            },
        );

        if (!product) {
            return res.status(404).json({
                error: "Product not found",
            });
        }

        // update inventory silently
        Inventory.updateOne(
            { product: id },
            {
                $set: { barcode },
            },
        ).catch(console.log);

        return res.status(200).json(product);
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            error: "Internal server error",
        });
    }
};
// Update a product by ID tests
const updateProduct = async (req, res) => {
    const { id } = req.params;

    let updates = req.body;
    try {
        if (updates?.quantity) {
            updates.quantity = parseInt(updates?.quantity);
        }
        if (updates?.sellingPrice < updates?.buyingPrice) {
            return res.status(400).json({
                error: "Selling price must be greater than buying price",
            });
        }
        let cominInQty = req.body?.quantity;
        let items = await updateProductBundle(id, updates);
        const product = await populateProductFields(
            Product.findByIdAndUpdate(id, req.body, { new: true }),
        );
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        let response = await Inventory.findOneAndUpdate(
            {
                product: new ObjectId(id),
                shop: new ObjectId(product?.shopId),
            },
            {
                $set: {
                    quantity: cominInQty,
                    bundleItems: items,
                    bundle: items?.length > 0,
                    attendant: new ObjectId(updates?.admin),
                },
            },
            {
                upsert: true,
            },
        );
        if (
            response?.quantity < cominInQty ||
            response?.quantity > cominInQty
        ) {
            let activity = Activity({
                name: `${product?.name} quantity was updated from ${response?.quantity} to ${cominInQty}`,
                shop: product?.shopId,
                user: updates?.admin ?? updates?.adminId,
            });
            activity.save();
        }

        res.status(200).json(product);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const productstats = async (req, res) => {
    try {
        var { shopid } = req.query;

        // running low
        var runninglow = await Product.find({
            shopId: new ObjectId(shopid),
            deleted: false,
            quantity: { $gt: 0 },
            $expr: {
                $and: [
                    { $gt: ["$reorderLevel", 0] },
                    { $lte: ["$quantity", "$reorderLevel"] },
                ],
            },
        }).countDocuments();

        // out of stock
        var outofstock = await Product.find({
            shopId: new ObjectId(shopid),
            deleted: false,
            quantity: { $lte: 0 },
        }).countDocuments();

        // in stock
        var instock = await Product.find({
            shopId: new ObjectId(shopid),
            deleted: false,
            quantity: { $gt: 0 },
        }).countDocuments();

        // dormant products
        var days = 30;
        var fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);

        var soldProducts = await SaleItem.distinct("product", {
            shopId: new ObjectId(shopid),
            createdAt: { $gte: fromDate },
            status: { $ne: "cancelled" },
        });

        var dormant = await Product.find({
            shopId: new ObjectId(shopid),
            deleted: false,
            quantity: { $gt: 0 },
            _id: { $nin: soldProducts },
        }).countDocuments();

        // fast moving
        var fastmoving = await SaleItem.aggregate([
            {
                $match: {
                    shopId: new ObjectId(shopid),
                    createdAt: { $gte: fromDate },
                    status: { $ne: "cancelled" },
                },
            },
            {
                $group: {
                    _id: "$product",
                    totalSoldQty: { $sum: "$quantity" },
                    salesCount: { $sum: 1 },
                },
            },
            {
                $sort: { salesCount: -1 }, // fastest moving first
            },
            {
                $limit: 10,
            },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product",
                },
            },
            {
                $unwind: "$product",
            },
            {
                $project: {
                    _id: "$product._id",
                    name: "$product.name",
                    quantity: "$product.quantity",
                    reorderLevel: "$product.reorderLevel",
                    sellingPrice: "$product.sellingPrice",
                    totalSoldQty: 1,
                    salesCount: 1,
                },
            },
        ]);

        return res.status(200).json({
            runninglow,
            outofstock,
            instock,
            dormant,
            fastmoving,
        });
    } catch (err) {
        return res.status(500).json({
            status: false,
            message: err.message,
        });
    }
};

// Delete a product by ID
const deleteProduct = async (req, res) => {
    const { id, useWarehouse = false } = req.params;

    const { shop, production = false, bundleItems = [] } = req.query;

    try {
        // DELETE INVENTORY FIRST
        await Inventory.deleteMany({
            product: id,
            shop,
        });

        // DELETE PRODUCT
        await Product.findByIdAndDelete(id);

        // RETURN FAST
        res.status(200).json({
            success: true,
            message: "Product deleted successfully",
        });

        // BACKGROUND CLEANUP
        process.nextTick(async () => {
            try {
                // PRODUCTION
                if (production == true && bundleItems.length > 0) {
                    const promises = bundleItems.map(async (i) => {
                        let { quantity, id } = i;

                        await Inventory.updateOne(
                            {
                                shop: new ObjectId(shop),
                                _id: new ObjectId(id),
                            },
                            {
                                $inc: {
                                    quantity: -quantity,
                                },
                            },
                        );
                    });

                    await Promise.all(promises);
                }

                // SALES
                const sItems = await saleitem.find({
                    product: id,
                });

                const sItemIds = sItems.map((item) => item._id);

                await sales.deleteMany({
                    items: {
                        $in: sItemIds,
                    },
                });

                await saleitem.deleteMany({
                    product: id,
                });

                // RETURNS
                await salereturns.updateMany(
                    {
                        "items.product": id,
                    },
                    {
                        $pull: {
                            items: {
                                product: id,
                            },
                        },
                    },
                );

                // PURCHASES
                const pItems = await PurchaseItem.find({
                    product: id,
                });

                const pItemIds = pItems.map((item) => item._id);

                await Purchase.deleteMany({
                    items: {
                        $in: pItemIds,
                    },
                });

                await PurchaseItem.deleteMany({
                    product: id,
                });

                // TRANSFERS
                await transfer.updateMany(
                    {
                        "productId.product": id,
                    },
                    {
                        $pull: {
                            items: {
                                product: id,
                            },
                        },
                    },
                );

                // BAD STOCK
                await badstock.deleteMany({
                    productId: id,
                });

                // COUNTS
                await count.updateMany(
                    {
                        "products.productId": id,
                    },
                    {
                        $pull: {
                            items: {
                                productId: id,
                            },
                        },
                    },
                );

                // BATCHES
                await Batch.deleteMany({
                    product: id,
                });

                // BUNDLE ITEMS
                await BundleItem.deleteMany({
                    item: id,
                });

                console.log("Background cleanup completed:", id);
            } catch (bgError) {
                console.error("Background delete error:", bgError);
            }
        });
    } catch (error) {
        console.log(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
};
const searchProducts = async (req, res) => {
    try {
        const {
            name,
            userId,
            shopId,
            supplierId,
            reorder,
            outOfStock,
            highestBuyingPrice,
            highestSellingPrice,
        } = req.query;
        const query = { deleted: false };

        if (name) {
            query.name = { $regex: name, $options: "i" };
        }

        if (supplierId) {
            query.supplierId = supplierId;
        }

        if (shopId) {
            query.shopId = shopId;
        }
        if (outOfStock === "true") {
            query.quantity = 0;
        }
        if (userId) {
            query.userId = userId;
        }
        if ("reorder" in req.query) {
            query.$expr = { $lt: ["$reorderLevel", "$quantity"] };
        }

        const sortOptions = {};

        if (highestBuyingPrice === "true") {
            sortOptions.buyingPrice = -1;
        }

        if (highestSellingPrice === "true") {
            sortOptions.sellingPrice = -1;
        }

        const products = await populateProductFields(
            Product.find(query).sort(sortOptions),
        );
        res.status(200).json(products);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
    }
};
const getProductSummary = async (req, res) => {
    try {
        const { year, productId } = req.query;

        const startDate = new Date(`${year}-01-01`);
        const endDate = new Date(`${year}-12-31T23:59:59.999`);

        const summary = await Product.aggregate([
            {
                deleted: false,
                $match: {
                    date: {
                        $gte: startDate,
                        $lt: endDate,
                    },
                    _id: new ObjectId(productId), // Match the specific product
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m",
                            date: "$date",
                        },
                    },
                    count: { $sum: 1 },
                    totalBuyingPrice: { $sum: "$buyingPrice" },
                },
            },
            {
                $sort: {
                    _id: 1,
                },
            },
        ]);

        const result = [];
        const yearTotal = { count: 0, totalBuyingPrice: 0 };
        const startDateMonth = startDate.getMonth();
        const endDateMonth = endDate.getMonth();
        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];

        for (let month = startDateMonth; month <= endDateMonth; month++) {
            const yearMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
            const matchingSummary = summary.find(
                (item) => item._id === yearMonth,
            );
            const count = matchingSummary ? matchingSummary.count : 0;
            const totalBuyingPrice = matchingSummary
                ? matchingSummary.totalBuyingPrice
                : 0;

            yearTotal.count += count;
            yearTotal.totalBuyingPrice += totalBuyingPrice;

            result.push({
                month: monthNames[month],
                year: year,
                count,
                totalBuyingPrice,
            });
        }

        res.status(200).json({ result, yearTotal });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};
const getProductsByShopId = async (req, res) => {
    try {
        const shopId = req.params.shopId;

        // Find products that belong to the specified shopId
        const productsQuery = Product.find({ shopId, deleted: false });
        const products = await populateProductFields(productsQuery);
        res.status(200).json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error getting products by shopId" });
    }
};
const transferProducts = async (req, res) => {
    try {
        let { products } = req.body;
        let successCount = 0;
        let failCount = 0;

        const promises = products.map(async (i) => {
            try {
                // Find the category by name
                const category = await ProductCategory.findOneAndUpdate(
                    { name: i.productCategoryId, admin: i.adminId },
                    { name: i.productCategoryId, admin: i.adminId },
                    { upsert: true, new: true, setDefaultsOnInsert: true },
                );
                i.productCategoryId = category._id;

                // Check if the product already exists by name
                const existingProduct = await Product.findOne({
                    name: i.name,
                    shopId: i.shopId,
                });

                const supplier = await Supplier.findOneAndUpdate(
                    { name: i.supplierId, shopId: i.adminId },
                    { name: i.supplierId, shopId: i.shopId },
                    { upsert: true, new: true, setDefaultsOnInsert: true },
                );

                i.supplierId = supplier._id;
                i.quantity = i.quantity == "" ? 0 : i.quantity;

                if (!existingProduct) {
                    i.reorderLevel = i.reorderLevel == "" ? 0 : i.reorderLevel;
                    let productResponse = await Product.create(i);

                    const newInventory = new Inventory({
                        quantity: i.quantity,
                        product: productResponse?._id,
                        shop: i.shopId,
                        attendant: i.attendantId,
                    });
                    await newInventory.save();

                    let shopDetails = await Shop.findOne({ _id: i.shopId });
                    let trackBatch = shopDetails?.trackbatches;
                    await createNewBatch(productResponse, trackBatch);
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`Failed to import product: ${i.name}`, error);
                failCount++;
            }
        });

        // Wait for all product creations to complete
        await Promise.all(promises);

        res.status(200).json({
            message: `Imported ${successCount} products, ${failCount} failed.`,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};
const importProducts = async (req, res) => {
    try {
        let { products } = req.body;
        // console.log(products);
        let successCount = 0;
        let failCount = 0;
        let productsFailed = [];

        const promises = products.map(async (i) => {
            try {
                // Find the category by name
                const category = await ProductCategory.findOneAndUpdate(
                    { name: i.productCategoryId, admin: i.adminId },
                    { name: i.productCategoryId, admin: i.adminId },
                    { upsert: true, new: true, setDefaultsOnInsert: true },
                );
                i.productCategoryId = category._id;

                const supplier = await Supplier.findOneAndUpdate(
                    { name: i.supplierId, shopId: i.shopId },
                    { name: i.supplierId, shopId: i.shopId },
                    { upsert: true, new: true, setDefaultsOnInsert: true },
                );

                i.supplierId = supplier._id;
                i.quantity = i.quantity == "" ? 0 : i.quantity;

                // if (!existingProduct) {
                i.reorderLevel = i.reorderLevel == "" ? 0 : i.reorderLevel;
                let productResponse = await Product.create(i);
                console.log(productResponse?._id);

                const newInventory = new Inventory({
                    quantity: i.quantity,
                    product: productResponse?._id,
                    shop: i.shopId,
                    attendant: i.attendantId,
                });
                await newInventory.save();

                let shopDetails = await Shop.findOne({ _id: i.shopId });
                let trackBatch = shopDetails?.trackbatches;
                await createNewBatch(productResponse, trackBatch);
                successCount++;
                // } else {
                //   failCount++;
                // }
            } catch (error) {
                productsFailed.push(i.name);
                console.error(`Failed to import product: ${i.name}`, error);
                failCount++;
            }
        });

        // Wait for all product creations to complete
        await Promise.all(promises);
        console.log(productsFailed);
        res.status(200).json({
            message: `Imported ${successCount} products, ${failCount} failed.`,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const getStockReport = async (req, res) => {
    console.log("getStockReport");
    try {
        let { shopId } = req.params;
        let { page, limit, name } = req.query;
        const stockReport = await stockreport(shopId, page, limit, name);
        res.json(stockReport);
    } catch (error) {
        console.error("Error fetching stock report:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const updateProductImages = async (req, res) => {
    let newObj = {
        images: req.body.images,
    };
    try {
        let newProduct = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: newObj },
            { runValidators: true, new: true },
        );

        res.status(200)
            .setHeader("Content-Type", "application/json")
            .json({ success: true, data: newProduct });
    } catch (error) {
        res.status(422)
            .setHeader("Content-Type", "application/json")
            .json({ success: false, message: error + " " });
    }
};

const generateResports = async (req, res) => {
    try {
        let { dataType, reportType, email, shop, reportStatus } = req.body;
        let data = [];
        let query = {};
        console.log(req.body);
        if (dataType == "products") {
            if (reportStatus == "runninglow") {
                query.$expr = {
                    $lt: ["$quantity", { $ifNull: ["$reorderLevel", 0] }],
                };
            } else if (reportStatus == "outofstock") {
                query.$expr = { $lt: ["$quantity", 1] };
            } else if (reportStatus == "expired") {
                query.expiryDate = {
                    $exists: true,
                    $lt: toDateFormat(new Date()),
                };
            } else if (reportStatus == "Counted Today") {
                const today = new Date();
                const todayStart = new Date(today);
                todayStart.setHours(0, 0, 0, 0);
                const todayEnd = new Date(today);
                todayEnd.setHours(23, 59, 59, 999);
                let filter = {
                    createdAt: {
                        $gte: todayStart,
                        $lte: todayEnd,
                    },
                    shopId: shop,
                };
                const result =
                    await StockCount.find(filter).populate(
                        "products.productId",
                    );
                result.forEach((stockCount) => {
                    stockCount.products.map((product) => {
                        data.push({
                            Product: product.productId.name,
                            physicalCount: product.physicalCount,
                            initialQuantity: product.initialCount,
                            variance: product.variance,
                            buyingPrice: product.buyingPrice,
                            sellingPrice: product.sellingPrice,
                        });
                    });
                });
            } else if (reportStatus == "Never Counted") {
                query.lastcoundate = {
                    $exists: false,
                };
            }
            if (reportStatus != "Counted Today") {
                const products = await Product.find({
                    shopId: new ObjectId(shop),
                    ...query,
                });
                products.forEach((product) => {
                    data.push({
                        Product: product.name,
                        buyingPrice: product.buyingPrice,
                        sellingPrice: product.sellingPrice,
                        wholesalePrice: product.wholesalePrice,
                        measure: product.measure,
                        reorderLevel: product?.reorderLevel,
                        maxDiscount: product?.maxDiscount,
                        Description: product?.description,
                        supplier: product?.supplierId?.name,
                        Category: product?.productCategoryId?.name,
                        Quantity: product.quantity,
                        Manufacturer: product?.manufacturer,
                    });
                });
            }

            if (data.length > 0) {
                sendReportEmail(shop, data, dataType, email);
            }
        }
        if (data.length > 0) {
            return res.json({
                success: true,
                message:
                    "report with " +
                    data.length +
                    " items generated and sent to your email, please check your email",
            });
        } else {
            return res.json({ success: true, message: "no records found" });
        }
    } catch (error) {
        return res.json({ success: false, message: "Error occcured" });
    }
};

const sendReportEmail = async (shop, data, dataType, email) => {
    const shopData = await Shop.findById(shop).populate("adminId");
    if (shopData.adminId == null) return;
    // Generate Excel file
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, dataType + " Report");

    const fileName = `${dataType}_${shop}.xlsx`;
    const attachmentPath = path.join(__dirname, fileName); // Use __dirname
    XLSX.writeFile(wb, attachmentPath);
    try {
        // Send email
        await sendEmailNew({
            recipientEmail: email,
            recipientName: shopData.adminId.username,
            subject: dataType + " Report",
            slug: "report",
            placeholders: {
                shopname: shopData.name,
                username: shopData.adminId.username,
                dataType: dataType,
            },
            attachments: [
                {
                    filename: fileName,
                    path: attachmentPath,
                },
            ],
        });
    } finally {
        // Delete file after sending (even if email fails)
        if (fs.existsSync(attachmentPath)) {
            fs.unlinkSync(attachmentPath);
        }
    }
};

const adjustStock = async (req, res) => {
    let {
        type,
        quantity,
        useWarehouse = false,
        shop,
        product,
        before,
    } = req.body;
    console.log(req.body);
    let adjustQty = quantity;
    if (type == "remove") {
        adjustQty = -quantity;
    }
    try {
        await Product.findOneAndUpdate(
            {
                _id: new ObjectId(product),
                shopId: new ObjectId(shop),
            },
            {
                $inc: {
                    quantity: adjustQty,
                },
            },
            { runValidators: true, new: true },
        );
        let response = await Inventory.findOneAndUpdate(
            {
                product: new ObjectId(product),
                shop: new ObjectId(shop),
            },
            [
                {
                    $set: {
                        quantity: {
                            $cond: {
                                if: { $lt: ["$quantity", 0] },
                                then: adjustQty,
                                else: {
                                    $add: ["$quantity", adjustQty],
                                },
                            },
                        },
                    },
                },
            ],
            {
                runValidators: true,
                new: true,
            },
        );

        let adjust = new Adjustmet({
            product,
            shop,
            before,
            after: response.quantity,
            adjusted: quantity,
            type,
        });
        adjust.save();
        return res.json({
            success: true,
            message: "updated successfully",
            product: response,
        });
    } catch (e) {
        console.log(e);
    }
};

const getProductAdjustments = async (req, res) => {
    let { id } = req.params;
    let { page, limit, shop, product, fromDate, toDate, type } = req.query;
    console.log(id);
    let filter = {};
    if (fromDate && toDate) {
        filter.createdAt = {
            $gte: fromDateFormat(fromDate),
            $lt: toDateFormat(toDate),
        };
    }
    if (type) {
        filter.type = type;
    }

    try {
        const pageLimit = parseInt(page) || 1;
        const limitInt = parseInt(limit) || 10;
        const skip = (pageLimit - 1) * limit;
        console.log(filter);
        let adjustments = await Adjustmet.find({
            ...filter,
            product: new ObjectId(id),
            shop,
        })
            .populate("product", "name")
            .populate("shop", "name")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });
        const total = await Adjustmet.countDocuments({
            product: new ObjectId(id),
            shop,
        });

        res.status(200).json({
            success: true,
            data: adjustments,
            pagination: {
                total,
                pageLimit,
                pages: Math.ceil(total / limitInt),
            },
        });
    } catch (error) {
        res.status(422).json({ success: false, message: error.toString() });
    }
};

const getStockAndSalesSummary = async (req, res) => {
    console.log("getStockAndSalesSummary");
    // try {
    const { month, year, productId } = req.query;

    if (!month || !year || !productId) {
        return res
            .status(400)
            .json({ error: "month, year, and productId are required" });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    const start = new Date(yearNum, monthNum - 1, 1);
    const end = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

    const productObjectId = new ObjectId(productId);

    // Aggregated Sale Summary
    const [saleSummary = {}] = await saleitem.aggregate([
        {
            $match: {
                product: productObjectId,
                createdAt: { $gte: start, $lte: end },
            },
        },
        {
            $group: {
                _id: null,
                totalUnitsSold: { $sum: "$quantity" },
                totalSales: {
                    $sum: {
                        $subtract: [
                            { $multiply: ["$unitPrice", "$quantity"] },
                            { $ifNull: ["$lineDiscount", 0] },
                        ],
                    },
                },
            },
        },
    ]);

    // Aggregated Purchase Summary
    const [purchaseSummary = {}] = await PurchaseItem.aggregate([
        {
            $match: {
                product: productObjectId,
                createdAt: { $gte: start, $lte: end },
            },
        },
        {
            $group: {
                _id: null,
                totalStockIn: { $sum: "$quantity" },
            },
        },
    ]);

    // Optional: limit to 10 most recent transactions for UI
    const salesHistory = await saleitem
        .find({
            product: productObjectId,
            createdAt: { $gte: start, $lte: end },
        })
        .select("createdAt quantity unitPrice lineDiscount")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    const stockMovements = await PurchaseItem.find({
        product: productObjectId,
        createdAt: { $gte: start, $lte: end },
    })
        .select("createdAt quantity")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    // Compute fallback defaults
    const totalSales = saleSummary.totalSales || 0;
    const totalUnitsSold = saleSummary.totalUnitsSold || 0;
    const totalStockIn = purchaseSummary.totalStockIn || 0;
    const netMovement = totalStockIn - totalUnitsSold;

    return res.status(200).json({
        totalSales,
        totalUnitsSold,
        totalStockIn,
        totalStockOut: totalUnitsSold,
        netMovement,
        salesHistory: salesHistory.map((item) => ({
            date: item.createdAt,
            quantity: item.quantity,
            total: item.unitPrice * item.quantity - (item.lineDiscount || 0),
        })),
        stockMovements: stockMovements.map((item) => ({
            date: item.createdAt,
            quantity: item.quantity,
            source: "purchase",
        })),
    });
    // } catch (error) {
    //   console.error("Error generating summary:", error);
    //   return res.status(500).json({ error: "Internal server error" });
    // }
};

module.exports = {
    createProduct,
    getAllProducts,
    updateProduct,
    deleteProduct,
    getStockReport,
    createProductCategory,
    getAllProductCategories,
    updateProductCategory,
    deleteProductCategory,
    getProductById,
    searchProducts,
    getProductSummary,
    getProductsByShopId,
    importProducts,
    updateProductImages,
    getProductCategoryById,
    transferProducts,
    generateResports,
    adjustStock,
    getProductAdjustments,
    removebundleitem,
    getProductBundleItems,
    productstats,
    getStockAndSalesSummary,
    getProducts,
    bulkDelete,
    updateBarcode,
};
