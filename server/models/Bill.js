const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  customerName: {
    type: String,
    required: true,
    index: true
  },
  customerAddress: {
    type: String,
    required: true
  },
  manufacturer: {
    type: String,
    required: false,
    default: 'Unknown Manufacturer',
    index: true
  },
  assetCategory: {
    type: String,
    required: false,
    default: 'Electronics',
    index: true
  },
  model: {
    type: String,
    required: true
  },
  imeiSerialNumber: {
    type: String,
    default: ''
  },
  assetCost: {
    type: Number,
    required: true,
    min: 0
  },
  taxDetails: {
    rate: { type: Number, required: true },
    cgst: { type: Number, required: true },
    sgst: { type: Number, required: true },
    taxableValue: { type: Number, required: true },
    taxRate: { type: Number, required: true },
    totalTaxAmount: { type: Number, required: true }
  },
  amountInWords: {
    type: String,
    required: true
  },
  taxAmountInWords: {
    type: String,
    required: true
  },
  hdbFinance: {
    type: Boolean,
    default: false
  },
  originalPdfPath: {
    type: String,
    default: ''
  },
  generatedPdfPath: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['draft', 'generated', 'printed', 'archived'],
    default: 'draft'
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    default: ''
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  lastModifiedBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total amount
billSchema.virtual('totalAmount').get(function() {
  return this.assetCost;
});

// Virtual for formatted date
billSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
});

// Indexes for better query performance
billSchema.index({ createdAt: -1 });
billSchema.index({ manufacturer: 1, assetCategory: 1 });
billSchema.index({ assetCost: -1 });
billSchema.index({ status: 1 });

// Static method to get analytics
billSchema.statics.getAnalytics = async function() {
  const analytics = await this.aggregate([
    {
      $group: {
        _id: null,
        totalBills: { $sum: 1 },
        totalRevenue: { $sum: '$assetCost' },
        averageBillValue: { $avg: '$assetCost' },
        minBillValue: { $min: '$assetCost' },
        maxBillValue: { $max: '$assetCost' }
      }
    }
  ]);

  const monthlyData = await this.aggregate([
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

  const categoryData = await this.aggregate([
    {
      $group: {
        _id: '$assetCategory',
        count: { $sum: 1 },
        revenue: { $sum: '$assetCost' }
      }
    },
    { $sort: { revenue: -1 } }
  ]);

  const manufacturerData = await this.aggregate([
    {
      $group: {
        _id: '$manufacturer',
        count: { $sum: 1 },
        revenue: { $sum: '$assetCost' }
      }
    },
    { $sort: { revenue: -1 } }
  ]);

  return {
    summary: analytics[0] || {},
    monthlyData,
    categoryData,
    manufacturerData
  };
};

// Static method to get bills with pagination and filters
billSchema.statics.getBillsWithFilters = async function(filters = {}, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  const query = {};
  
  if (filters.customerName) {
    query.customerName = { $regex: filters.customerName, $options: 'i' };
  }
  
  if (filters.manufacturer) {
    query.manufacturer = { $regex: filters.manufacturer, $options: 'i' };
  }
  
  if (filters.assetCategory) {
    query.assetCategory = { $regex: filters.assetCategory, $options: 'i' };
  }
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) {
      query.createdAt.$gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      query.createdAt.$lte = new Date(filters.dateTo);
    }
  }

  const bills = await this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    bills,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
};

module.exports = mongoose.model('Bill', billSchema); 