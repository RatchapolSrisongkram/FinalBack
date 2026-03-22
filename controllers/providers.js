const Provider = require('../models/Provider');

// @desc    Get all providers
// @route   GET /api/v1/providers
exports.getProviders = async (req, res, next) => {
    try {
        const providers = await Provider.find();
        res.status(200).json({ success: true, count: providers.length, data: providers });
    } catch (err) {
        res.status(400).json({ success: false });
    }
};

// @desc    Create a provider
// @route   POST /api/v1/providers
exports.createProvider = async (req, res, next) => {
    try {
        const provider = await Provider.create(req.body);
        res.status(201).json({ success: true, data: provider });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// ==========================================
// 💡 เพิ่ม 2 ฟังก์ชันนี้ เพื่อให้ Admin แก้ไข/ลบได้
// ==========================================

// @desc    Update provider
// @route   PUT /api/v1/providers/:id
exports.updateProvider = async (req, res, next) => {
    try {
        const provider = await Provider.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!provider) {
            return res.status(404).json({ success: false, message: `No provider with id of ${req.params.id}` });
        }

        res.status(200).json({ success: true, data: provider });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete provider
// @route   DELETE /api/v1/providers/:id
exports.deleteProvider = async (req, res, next) => {
    try {
        const provider = await Provider.findById(req.params.id);

        if (!provider) {
            return res.status(404).json({ success: false, message: `No provider with id of ${req.params.id}` });
        }

        await provider.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};