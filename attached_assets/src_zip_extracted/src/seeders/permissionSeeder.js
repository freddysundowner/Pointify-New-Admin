// seeders/permissionSeeder.js
const Permission = require('../models/permissions');

const defaultPermissions = [
    { key: "pos", value: ["set_sale_date", "can_sell", "can_sell_to_dealer_&_wholesaler", "discount", "edit_price"] },
    { key: "stocks", value: ["view_products", "add_products", "view_buying_price", "stock_summary", "view_purchases", "add_purchases", "stock_count", "badstock", "transfer", "return", "delete_purchase_invoice"] },
    { key: "products", value: ["edit", "delete", "add", "adjust_stock", "view_adjustment_history"] },
    { key: "sales", value: ["view_sales", "return", "delete", "view_profit"] },
    { key: "reports", value: ["sales", "dues", "productsales", "discoutedsales", "debtors", "purchases", "expenses", "stocktake", "netprofit", "stockreport", "productmovement", "profitanalysis"] },
    { key: "purchases", value: ["edit_buying_price"] },
    { key: "accounts", value: ["cashflow"] },
    { key: "expenses", value: ["manage"] },
    { key: "suppliers", value: ["manage"] },
    { key: "customers", value: ["manage", "deposit"] },
    { key: "shop", value: ["manage", "switch"] },
    { key: "attendants", value: ["manage", "view"] },
    { key: "usage", value: ["manage"] },
    { key: "support", value: ["manage"] },
    { key: "production", value: ["delete", "change_status", "edit", "adjust_stock", "view_adjustment_history"] },
    { key: "warehouse", value: ["invoice_delete", "show_buying_price", "show_available_stock", "view_buying_price", "create_orders", "view_orders", "return", "accept_warehouse_orders"] }
];

const seedPermissions = async () => {
    try {
        const count = await Permission.countDocuments();

        if (count === 0) {
            await Permission.insertMany(defaultPermissions);
            console.log('Default permissions seeded successfully');
        } else {
            console.log('Permissions already exist, skipping seed');
        }
    } catch (error) {
        console.error('Error seeding permissions:', error.message);
    }
};

module.exports = seedPermissions;