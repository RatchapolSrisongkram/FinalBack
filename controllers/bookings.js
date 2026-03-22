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

        query = query.populate({
            path: 'car',
            select: 'make model year licensePlate dailyRate picture provider',
            populate: {
                path: 'provider',
                select: 'name address telephone'
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
exports.getBooking = async (req, res, next) => {
    try {
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
// @route   POST /api/v1/cars/:carId/bookings
exports.addBooking = async (req, res, next) => {
    try {
        req.body.car = req.params.carId;
        req.body.user = req.user.id;

        const car = await Car.findById(req.params.carId);
        if (!car) {
            return res.status(404).json({ success: false, message: `No car with the id of ${req.params.carId}` });
        }

        const existedBookings = await Booking.find({ user: req.user.id });
        if (existedBookings.length >= 3 && req.user.role !== 'admin') {
            return res.status(400).json({ success: false, message: `The user with ID ${req.user.id} has already made 3 bookings` });
        }

        const { pickUpDate, dropOffDate } = req.body;
        const pDate = new Date(pickUpDate);
        const dDate = new Date(dropOffDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (pDate < today) {
            return res.status(400).json({ success: false, message: 'Pick-up date cannot be in the past' });
        }

        if (dDate <= pDate) {
            return res.status(400).json({ success: false, message: 'Drop-off date must be after pick-up date' });
        }

        const overlappedBooking = await Booking.findOne({
            car: req.params.carId,
            pickUpDate: { $lte: dDate },
            dropOffDate: { $gte: pDate }
        });

        if (overlappedBooking) {
            return res.status(400).json({ success: false, message: 'รถคันนี้ถูกจองไปแล้วในช่วงเวลาที่คุณเลือก โปรดเลือกวันอื่น' });
        }

        const booking = await Booking.create(req.body);
        
        res.status(201).json({ success: true, data: booking });

    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, message: err.message || 'Cannot create Booking' });
    }
};

// @desc    Update booking
// @route   PUT /api/v1/bookings/:id
exports.updateBooking = async (req, res, next) => {
    try {
        let booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "No booking found" });

        // ตรวจสอบสิทธิ์ (Admin หรือเจ้าของถึงจะแก้ได้)
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: "Not authorized to update this booking" });
        }

        // เช็ค Overlap โดยดึงวันที่เดิมมาใช้ในกรณีที่ส่งมาแก้แค่วันเดียว
        if (req.body.pickUpDate || req.body.dropOffDate) {
            const pDate = new Date(req.body.pickUpDate || booking.pickUpDate);
            const dDate = new Date(req.body.dropOffDate || booking.dropOffDate);
            
            const overlappedBooking = await Booking.findOne({
                _id: { $ne: req.params.id }, 
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

        // 💡 แก้ไขตรงนี้: เปลี่ยนจาก new: true เป็น returnDocument: 'after'
        booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
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

        // ตรวจสอบสิทธิ์ (Admin หรือเจ้าของถึงจะลบได้)
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: "Not authorized to delete this booking" });
        }

        await booking.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Cannot delete Booking' });
    }
};