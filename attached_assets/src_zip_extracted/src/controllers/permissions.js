// controllers/permissionController.js
const Permission = require('../models/permissions');

exports.getAll = async (req, res) => {
    try {
        const permissions = await Permission.find().sort({ key: 1 });
        res.json({ data: permissions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { key, value } = req.body;

        const existing = await Permission.findOne({ key });
        if (existing) {
            return res.status(400).json({ error: 'Permission category already exists' });
        }

        const permission = new Permission({ key, value: value || [] });
        await permission.save();
        res.status(201).json(permission);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const permission = await Permission.findByIdAndDelete(req.params.id);
        if (!permission) {
            return res.status(404).json({ error: 'Permission not found' });
        }
        res.json({ message: 'Permission deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};