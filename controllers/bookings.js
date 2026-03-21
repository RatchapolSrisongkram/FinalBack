const Booking = require('../models/Booking');
const Provider = require('../models/Provider');
const Car = require('../models/Car');

// @desc    Get all bookings
// @route   GET /api/v1/bookings
exports.getBookings = async (req, res, next) => {
    try {
        let query;
        if (req.user.role !== 'admin') {
            query = Booking.find({ user: req.user.id });
        } else {
            query = Booking.find();
        }

        // ✨ แก้ไขจุดนี้: สั่ง Populate แบบซ้อนชั้น (Nested)
        query = query.populate({
            path: 'car',
            select: 'make model year licensePlate dailyRate picture provider', // ดึงฟิลด์ provider ใน car มาด้วย
            populate: {
                path: 'provider',
                select: 'name address telephone' // ดึงข้อมูลจาก Collection Providers มาโชว์
            }
        });

        const bookings = await query;
        res.status(200).json({ success: true, count: bookings.length, data: bookings });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Cannot find Booking' });
    }
};

// @desc    Get single booking by ID
// @route   GET /api/v1/bookings/:id
// ✅ แก้ชื่อจาก getBookings เป็น getBooking (ตามที่ Route เรียกใช้)
exports.getBooking = async (req, res, next) => {
    try {
        // ✅ เปลี่ยนจาก .find() เป็น .findById(req.params.id) เพื่อดึงแค่ตัวเดียว
        const booking = await Booking.findById(req.params.id)
            .populate({ path: 'provider', select: 'name address telephone' })
            .populate({ path: 'car', select: 'make model year licensePlate dailyRate picture' });

        if (!booking) {
            return res.status(404).json({ success: false, message: `No booking with id ${req.params.id}` });
        }

        // ตรวจสอบสิทธิ์ (ถ้าไม่ใช่เจ้าของ และไม่ใช่ Admin)
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Not authorized to view this booking' });
        }

        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Cannot find Booking' });
    }
};

// @desc    Add booking
// @route   POST /api/v1/providers/:providerId/bookings
exports.addBooking = async (req, res, next) => {
    try {
        req.body.car = req.params.carId;
        req.body.user = req.user.id;

        // 1. ตรวจสอบว่ามีรถคันนี้จริงไหม
        const car = await Car.findById(req.params.carId);
        if (!car) {
            return res.status(404).json({ 
                success: false, 
                message: `No car with the id of ${req.params.carId}` 
            });
        }

        // 2. [เงื่อนไขเพิ่ม] ห้ามจองเกิน 3 คัน (ยกเว้น Admin)
        const existedBookings = await Booking.find({ user: req.user.id });
        if (existedBookings.length >= 3 && req.user.role !== 'admin') {
            return res.status(400).json({ 
                success: false, 
                message: `The user with ID ${req.user.id} has already made 3 bookings` 
            });
        }

        // 3. [เงื่อนไขเพิ่ม] ดึงวันที่จาก body มาเช็ค
        const { pickUpDate, dropOffDate } = req.body;
        const pDate = new Date(pickUpDate);
        const dDate = new Date(dropOffDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // ตั้งเวลาเป็น 00:00 ของวันนี้

        // เช็ค: ห้ามจองย้อนหลัง
        if (pDate < today) {
            return res.status(400).json({ 
                success: false, 
                message: 'Pick-up date cannot be in the past' 
            });
        }

        // เช็ค: วันคืนรถต้องหลังวันรับรถ
        if (dDate <= pDate) {
            return res.status(400).json({ 
                success: false, 
                message: 'Drop-off date must be after pick-up date' 
            });
        }

        const overlappedBooking = await Booking.findOne({
            car: req.params.carId,
            // เงื่อนไขเวลาทับซ้อน: วันรับรถเก่า <= วันคืนรถใหม่ และ วันคืนรถเก่า >= วันรับรถใหม่
            pickUpDate: { $lte: dDate },
            dropOffDate: { $gte: pDate }
        });

        if (overlappedBooking) {
            return res.status(400).json({ 
                success: false, 
                message: 'รถคันนี้ถูกจองไปแล้วในช่วงเวลาที่คุณเลือก โปรดเลือกวันอื่น' 
            });
        }

        // 4. ถ้าผ่านทุกเงื่อนไข ให้สร้าง Booking
        const booking = await Booking.create(req.body);
        
        res.status(201).json({ 
            success: true, 
            data: booking 
        });

    } catch (err) {
        console.error(err);
        res.status(400).json({ 
            success: false, 
            message: err.message || 'Cannot create Booking' 
        });
    }
};

// @desc    Update booking
// @route   PUT /api/v1/bookings/:id
exports.updateBooking = async (req, res, next) => {
    try {
        let booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "No booking found" });

        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: "Not authorized" });
        }


        if (req.body.pickUpDate && req.body.dropOffDate) {
            const pDate = new Date(req.body.pickUpDate);
            const dDate = new Date(req.body.dropOffDate);
            
            const overlappedBooking = await Booking.findOne({
                _id: { $ne: req.params.id }, // $ne คือ Not Equal: ข้ามการเช็คชนกับ ID ของตัวเอง
                car: booking.car,
                pickUpDate: { $lte: dDate },
                dropOffDate: { $gte: pDate }
            });

            if (overlappedBooking) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ไม่สามารถเปลี่ยนวันได้: รถคันนี้ถูกจองไปแล้วในช่วงเวลาใหม่ที่คุณเลือก' 
                });
            }
        }

        booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Cannot update Booking' });
    }
};

// @desc    Delete booking
// @route   DELETE /api/v1/bookings/:id
exports.deleteBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "No booking found" });

        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: "Not authorized" });
        }

        await booking.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Cannot delete Booking' });
    }
};