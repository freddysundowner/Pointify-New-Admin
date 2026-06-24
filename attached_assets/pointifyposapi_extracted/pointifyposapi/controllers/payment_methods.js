const paymentMethodSchema = require("../models/pament_methods");
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");

exports.addPaymentMethod = async (req, res) => {
    try {
        console.log(req.body);
        let datasArray = req.body;
        datasArray.forEach(async (data) => {
            let exists = await paymentMethodSchema.findOne({ name: data.name });
            if (exists) {
                // upload icon using multer

                await paymentMethodSchema.updateOne({ name: data.name }, {settings: data.settings, active: data.active});
            }else{
                let pmt = new paymentMethodSchema(data);
                pmt.save();
            }
        })
        res.status(201).json({ message: 'Payment method added successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updatePaymentMethod = async (req, res) => {
    try {
        const updatedPaymentMethod = await paymentMethodSchema.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedPaymentMethod) {
            return res.status(404).json({ message: 'Payment method not found' });
        }
        res.json(updatedPaymentMethod);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deletePaymentMethod = async (req, res) => {
    try {
        const deletedPaymentMethod = await paymentMethodSchema.findByIdAndDelete(req.params.id);
        if (!deletedPaymentMethod) {
            return res.status(404).json({ message: 'Payment method not found' });
        }
        res.json(deletedPaymentMethod);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getPaymentMethodById = async (req, res) => {
    try {
        const paymentMethod = await paymentMethodSchema.findById(req.params.id);
        if (!paymentMethod) {
            return res.status(404).json({ message: 'Payment method not found' });
        }
        res.json(paymentMethod);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllPaymentMethods = async (req, res) => {
    let {keys = "false"} = req.query;
    try {
        const paymentMethods = await paymentMethodSchema.find();
        let data = [];
        if(keys == "false"){
            paymentMethods.forEach(element => {
                data.push({
                    _id: element._id,
                    name: element.name,
                    active: element.active
                });
            });
        }else{
            data = paymentMethods;
        }
        res.json(paymentMethods);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};