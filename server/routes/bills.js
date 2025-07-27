const express = require('express');
const router = express.Router();
const Bill = require('../models/Bill');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Check disk space
router.get('/disk-space', async (req, res) => {
  try {
    const drive = path.parse(process.cwd()).root;
    const stats = fs.statSync(drive);
    const totalSpace = stats.size;
    const freeSpace = require('fs').statSync(drive).size;
    
    const usedSpace = totalSpace - freeSpace;
    const usagePercentage = (usedSpace / totalSpace) * 100;
    
    res.json({
      success: true,
      data: {
        totalSpace: totalSpace,
        freeSpace: freeSpace,
        usedSpace: usedSpace,
        usagePercentage: usagePercentage.toFixed(2),
        drive: drive
      }
    });
  } catch (error) {
    console.error('Error checking disk space:', error);
    res.status(500).json({ success: false, message: 'Error checking disk space' });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// Get all bills with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, customerName, manufacturer, assetCategory, status, dateFrom, dateTo } = req.query;
    
    const filters = {
      customerName,
      manufacturer,
      assetCategory,
      status,
      dateFrom,
      dateTo
    };

    const result = await Bill.getBillsWithFilters(filters, parseInt(page), parseInt(limit));
    
    res.json({
      success: true,
      data: result.bills,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalItems: result.total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ success: false, message: 'Error fetching bills' });
  }
});

// Get single bill by ID
router.get('/:id', async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    res.json({ success: true, data: bill });
  } catch (error) {
    console.error('Error fetching bill:', error);
    res.status(500).json({ success: false, message: 'Error fetching bill' });
  }
});

// Create new bill
router.post('/', async (req, res) => {
  try {
    const billData = req.body;
    
    // Clean and validate data before saving
    const cleanedData = {
      ...billData,
      customerName: billData.customerName || 'Unknown Customer',
      customerAddress: billData.customerAddress || 'No Address',
      manufacturer: billData.manufacturer || 'Unknown Manufacturer',
      assetCategory: billData.assetCategory || 'Electronics',
      model: billData.model || 'Unknown Model',
      imeiSerialNumber: billData.imeiSerialNumber || '',
      assetCost: billData.assetCost || 0,
      hdbFinance: billData.hdbFinance || false
    };

    // Clean up asset category for IDFC bills
    if (cleanedData.customerName.includes('IDFC FIRST BANK')) {
      // Remove any trailing 'D' and clean up extra text
      if (cleanedData.assetCategory && cleanedData.assetCategory.endsWith('D')) {
        cleanedData.assetCategory = cleanedData.assetCategory.slice(0, -1).trim();
      }
      
      // If asset category is too long, take only the first few words
      if (cleanedData.assetCategory && cleanedData.assetCategory.length > 20) {
        const categoryWords = cleanedData.assetCategory.split(/\s+/);
        cleanedData.assetCategory = categoryWords.slice(0, 2).join(' ').trim();
      }
      
      // Clean up model if it's too long
      if (cleanedData.model && cleanedData.model.length > 30) {
        const modelWords = cleanedData.model.split(/\s+/);
        cleanedData.model = modelWords.slice(0, 3).join(' ').trim();
      }
    }
    
    // Check if invoice number already exists
    const existingBill = await Bill.findOne({ invoiceNumber: cleanedData.invoiceNumber });
    if (existingBill) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invoice number already exists' 
      });
    }

    const bill = new Bill(cleanedData);
    await bill.save();
    
    res.status(201).json({ success: true, data: bill });
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ success: false, message: 'Error creating bill' });
  }
});

// Update bill
router.put('/:id', async (req, res) => {
  try {
    const billData = req.body;
    
    // Check if invoice number already exists (excluding current bill)
    if (billData.invoiceNumber) {
      const existingBill = await Bill.findOne({ 
        invoiceNumber: billData.invoiceNumber,
        _id: { $ne: req.params.id }
      });
      if (existingBill) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invoice number already exists' 
        });
      }
    }

    const bill = await Bill.findByIdAndUpdate(
      req.params.id,
      billData,
      { new: true, runValidators: true }
    );
    
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    
    res.json({ success: true, data: bill });
  } catch (error) {
    console.error('Error updating bill:', error);
    res.status(500).json({ success: false, message: 'Error updating bill' });
  }
});

// Delete bill
router.delete('/:id', async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    
    // Delete associated PDF files if they exist
    if (bill.originalPdfPath && fs.existsSync(bill.originalPdfPath)) {
      fs.unlinkSync(bill.originalPdfPath);
    }
    if (bill.generatedPdfPath && fs.existsSync(bill.generatedPdfPath)) {
      fs.unlinkSync(bill.generatedPdfPath);
    }
    
    res.json({ success: true, message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('Error deleting bill:', error);
    res.status(500).json({ success: false, message: 'Error deleting bill' });
  }
});

// Upload PDF file
router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    res.json({ 
      success: true, 
      data: { 
        filename: req.file.filename,
        path: req.file.path 
      } 
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({ success: false, message: 'Error uploading PDF' });
  }
});

// Get analytics
router.get('/analytics/summary', async (req, res) => {
  try {
    const analytics = await Bill.getAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ success: false, message: 'Error fetching analytics' });
  }
});

// Get monthly analytics
router.get('/analytics/monthly', async (req, res) => {
  try {
    const { year } = req.query;
    const query = {};
    
    if (year) {
      query.createdAt = {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${parseInt(year) + 1}-01-01`)
      };
    }

    const monthlyData = await Bill.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$assetCost' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({ success: true, data: monthlyData });
  } catch (error) {
    console.error('Error fetching monthly analytics:', error);
    res.status(500).json({ success: false, message: 'Error fetching monthly analytics' });
  }
});

// Get category analytics
router.get('/analytics/categories', async (req, res) => {
  try {
    const categoryData = await Bill.aggregate([
      {
        $group: {
          _id: '$assetCategory',
          count: { $sum: 1 },
          revenue: { $sum: '$assetCost' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    res.json({ success: true, data: categoryData });
  } catch (error) {
    console.error('Error fetching category analytics:', error);
    res.status(500).json({ success: false, message: 'Error fetching category analytics' });
  }
});

// Get manufacturer analytics
router.get('/analytics/manufacturers', async (req, res) => {
  try {
    const manufacturerData = await Bill.aggregate([
      {
        $group: {
          _id: '$manufacturer',
          count: { $sum: 1 },
          revenue: { $sum: '$assetCost' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    res.json({ success: true, data: manufacturerData });
  } catch (error) {
    console.error('Error fetching manufacturer analytics:', error);
    res.status(500).json({ success: false, message: 'Error fetching manufacturer analytics' });
  }
});

// Search bills
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const searchQuery = {
      $or: [
        { customerName: { $regex: query, $options: 'i' } },
        { manufacturer: { $regex: query, $options: 'i' } },
        { assetCategory: { $regex: query, $options: 'i' } },
        { model: { $regex: query, $options: 'i' } },
        { invoiceNumber: { $regex: query, $options: 'i' } }
      ]
    };

    const bills = await Bill.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Bill.countDocuments(searchQuery);

    res.json({
      success: true,
      data: bills,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error searching bills:', error);
    res.status(500).json({ success: false, message: 'Error searching bills' });
  }
});

// Cleanup old bills to free up space
router.delete('/cleanup', async (req, res) => {
  try {
    const { daysOld = 365, status = 'archived' } = req.query;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld));
    
    const result = await Bill.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: status
    });
    
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} old bills`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up bills:', error);
    res.status(500).json({ success: false, message: 'Error cleaning up bills' });
  }
});

// Archive old bills instead of deleting
router.put('/archive', async (req, res) => {
  try {
    const { daysOld = 365 } = req.query;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld));
    
    const result = await Bill.updateMany(
      {
        createdAt: { $lt: cutoffDate },
        status: { $ne: 'archived' }
      },
      {
        $set: { status: 'archived' }
      }
    );
    
    res.json({
      success: true,
      message: `Archived ${result.modifiedCount} old bills`,
      archivedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error archiving bills:', error);
    res.status(500).json({ success: false, message: 'Error archiving bills' });
  }
});

// Fix IDFC bills asset categories
router.put('/fix-idfc', async (req, res) => {
  try {
    // Find all bills that contain "IDFC FIRST BANK" in customer name
    const idfcBills = await Bill.find({
      customerName: { $regex: 'IDFC FIRST BANK', $options: 'i' }
    });

    let fixedCount = 0;
    
    for (const bill of idfcBills) {
      let needsUpdate = false;
      const updates = {};
      
      // Fix asset category if it contains extra text
      if (bill.assetCategory && bill.assetCategory.length > 20) {
        // Extract just the category name (usually first word or two)
        const categoryWords = bill.assetCategory.split(/\s+/);
        const cleanCategory = categoryWords.slice(0, 2).join(' ').trim();
        if (cleanCategory && cleanCategory !== bill.assetCategory) {
          updates.assetCategory = cleanCategory;
          needsUpdate = true;
        }
      }
      
      // Fix model if it contains extra text
      if (bill.model && bill.model.length > 30) {
        // Extract just the model name (usually first few words)
        const modelWords = bill.model.split(/\s+/);
        const cleanModel = modelWords.slice(0, 3).join(' ').trim();
        if (cleanModel && cleanModel !== bill.model) {
          updates.model = cleanModel;
          needsUpdate = true;
        }
      }
      
      // Update the bill if needed
      if (needsUpdate) {
        await Bill.findByIdAndUpdate(bill._id, updates);
        fixedCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Fixed ${fixedCount} IDFC bills`,
      fixedCount
    });
  } catch (error) {
    console.error('Error fixing IDFC bills:', error);
    res.status(500).json({ success: false, message: 'Error fixing IDFC bills' });
  }
});

module.exports = router; 