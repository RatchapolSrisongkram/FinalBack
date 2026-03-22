const express = require('express');
const { 
    getProviders, 
    createProvider, 
    updateProvider,  // 💡 import เพิ่ม
    deleteProvider   // 💡 import เพิ่ม
} = require('../controllers/providers');

// Router ของ Booking และ Car
const bookingRouter = require('./bookings');
const carRouter = require('./cars'); 

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use('/:providerId/bookings', bookingRouter);
router.use('/:providerId/cars', carRouter); 

router.route('/')
    .get(protect, getProviders)
    .post(protect, authorize('admin'), createProvider);

// ==========================================
// 💡 เพิ่ม Route นี้ เพื่อให้ยิง API มาแก้ไข/ลบได้
// ==========================================
router.route('/:id')
    .put(protect, authorize('admin'), updateProvider)
    .delete(protect, authorize('admin'), deleteProvider);

module.exports = router;