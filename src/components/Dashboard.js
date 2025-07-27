import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Download,
  DollarSign,
  Package,
  FileText,
  RefreshCw
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const [bills, setBills] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    customerName: '',
    manufacturer: '',
    assetCategory: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [diskSpace, setDiskSpace] = useState(null);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  const API_BASE_URL = 'http://localhost:5000/api';

  const fetchBills = useCallback(async (page = currentPage, filterParams = filters) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page,
        limit: 10,
        ...filterParams
      });

      const response = await fetch(`${API_BASE_URL}/bills?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        setBills(data.data);
        setTotalPages(data.pagination.totalPages);
        if (data.data.length > 0) {
          setNotification(`Loaded ${data.data.length} bills`);
          setTimeout(() => setNotification(null), 3000);
        }
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/bills/analytics/summary`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  }, []);

  const fetchDiskSpace = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/bills/disk-space`);
      const data = await response.json();
      if (data.success) {
        setDiskSpace(data.data);
      }
    } catch (error) {
      console.error('Error fetching disk space:', error);
    }
  }, []);

  const handleCleanup = async (daysOld = 365) => {
    if (window.confirm(`Are you sure you want to delete bills older than ${daysOld} days? This action cannot be undone.`)) {
      try {
        const response = await fetch(`${API_BASE_URL}/bills/cleanup?daysOld=${daysOld}`, {
          method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
          alert(`Successfully deleted ${data.deletedCount} old bills`);
          fetchBills(currentPage, filters);
          fetchDiskSpace();
        }
      } catch (error) {
        console.error('Error cleaning up bills:', error);
        alert('Error cleaning up bills');
      }
    }
  };

  const handleArchive = async (daysOld = 365) => {
    if (window.confirm(`Are you sure you want to archive bills older than ${daysOld} days?`)) {
      try {
        const response = await fetch(`${API_BASE_URL}/bills/archive?daysOld=${daysOld}`, {
          method: 'PUT'
        });
        const data = await response.json();
        if (data.success) {
          alert(`Successfully archived ${data.archivedCount} old bills`);
          fetchBills(currentPage, filters);
          fetchDiskSpace();
        }
      } catch (error) {
        console.error('Error archiving bills:', error);
        alert('Error archiving bills');
      }
    }
  };

  useEffect(() => {
    fetchBills(currentPage, filters);
    fetchAnalytics();
    fetchDiskSpace();
  }, [fetchBills, fetchAnalytics, fetchDiskSpace, currentPage, filters]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!refreshing) {
        fetchBills(currentPage, filters);
        fetchAnalytics();
        fetchDiskSpace();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchBills, fetchAnalytics, fetchDiskSpace, currentPage, filters, refreshing]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchBills(currentPage, filters);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/bills/search/${encodeURIComponent(searchQuery)}?page=${currentPage}&limit=10`);
      const data = await response.json();

      if (data.success) {
        setBills(data.data);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error searching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([
      fetchBills(currentPage, filters),
      fetchAnalytics(),
      fetchDiskSpace()
    ]).finally(() => {
      setRefreshing(false);
    });
  };

  const fixIDFCBills = async () => {
    if (window.confirm('This will attempt to fix asset categories for existing IDFC bills. Continue?')) {
      try {
        setRefreshing(true);
        const response = await fetch(`${API_BASE_URL}/bills/fix-idfc`, {
          method: 'PUT'
        });
        const data = await response.json();
        if (data.success) {
          setNotification(`Fixed ${data.fixedCount} IDFC bills`);
          setTimeout(() => setNotification(null), 3000);
          fetchBills(currentPage, filters);
          fetchAnalytics();
        }
      } catch (error) {
        console.error('Error fixing IDFC bills:', error);
        setNotification('Error fixing IDFC bills');
        setTimeout(() => setNotification(null), 3000);
      } finally {
        setRefreshing(false);
      }
    }
  };

  const handleDeleteBill = async (billId) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/bills/${billId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchBills(currentPage, filters);
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Error deleting bill:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: '#6b7280',
      generated: '#059669',
      printed: '#2563eb',
      archived: '#7c3aed'
    };
    return colors[status] || '#6b7280';
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>Bill Management Dashboard</h1>
        <div className="header-actions">
          <button 
            className="btn-secondary" 
            onClick={handleRefresh} 
            title="Refresh Dashboard"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn-primary">
            <Plus size={16} />
            New Bill
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => setShowDebug(!showDebug)}
            title="Toggle Debug Mode"
          >
            Debug
          </button>
          <button 
            className="btn-secondary" 
            onClick={fixIDFCBills}
            title="Fix IDFC Bills"
            disabled={refreshing}
          >
            Fix IDFC
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="card-icon">
            <FileText color="#2563eb" />
          </div>
          <div className="card-content">
            <h3>{analytics.summary?.totalBills || 0}</h3>
            <p>Total Bills</p>
          </div>
        </div>

        <div className="analytics-card">
          <div className="card-icon">
            <DollarSign color="#059669" />
          </div>
          <div className="card-content">
            <h3>{formatCurrency(analytics.summary?.totalRevenue || 0)}</h3>
            <p>Total Revenue</p>
          </div>
        </div>

        <div className="analytics-card">
          <div className="card-icon">
            <TrendingUp color="#7c3aed" />
          </div>
          <div className="card-content">
            <h3>{formatCurrency(analytics.summary?.averageBillValue || 0)}</h3>
            <p>Average Bill Value</p>
          </div>
        </div>

        <div className="analytics-card">
          <div className="card-icon">
            <Package color="#dc2626" />
          </div>
          <div className="card-content">
            <h3>{analytics.categoryData?.length || 0}</h3>
            <p>Product Categories</p>
          </div>
        </div>

        {/* Disk Space Card */}
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => setShowStorageModal(true)}>
          <div className="card-icon">
            <FileText color="#059669" />
          </div>
          <div className="card-content">
            <h3>{diskSpace ? `${diskSpace.usagePercentage}%` : '--'}</h3>
            <p>Disk Usage</p>
            {diskSpace && (
              <small style={{ color: diskSpace.usagePercentage > 80 ? '#dc2626' : '#059669' }}>
                {diskSpace.freeSpace > 1073741824 
                  ? `${(diskSpace.freeSpace / 1073741824).toFixed(1)}GB free`
                  : `${(diskSpace.freeSpace / 1048576).toFixed(1)}MB free`
                }
              </small>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="search-filters">
        <div className="search-section">
          <div className="search-input">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search bills by customer, manufacturer, model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="search-btn">
              Search
            </button>
          </div>
        </div>

        <div className="filters-section">
          <button
            className="filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
          </button>

          {showFilters && (
            <div className="filters-panel">
              <div className="filter-row">
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={filters.customerName}
                  onChange={(e) => handleFilterChange('customerName', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Manufacturer"
                  value={filters.manufacturer}
                  onChange={(e) => handleFilterChange('manufacturer', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Asset Category"
                  value={filters.assetCategory}
                  onChange={(e) => handleFilterChange('assetCategory', e.target.value)}
                />
              </div>
              <div className="filter-row">
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="generated">Generated</option>
                  <option value="printed">Printed</option>
                  <option value="archived">Archived</option>
                </select>
                <input
                  type="date"
                  placeholder="From Date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
                <input
                  type="date"
                  placeholder="To Date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bills Table */}
      <div className="bills-table-container">
        <div className="table-header">
          <h2>Recent Bills</h2>
          <div className="table-actions">
            <span>{bills.length} bills found</span>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading bills...</div>
        ) : (
          <div className="bills-table">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill._id}>
                    <td>{bill.invoiceNumber}</td>
                    <td>
                      <div className="customer-info">
                        <strong>{bill.customerName}</strong>
                        <small>{bill.customerAddress}</small>
                      </div>
                    </td>
                    <td>
                      <div className="product-info">
                        <strong>{bill.manufacturer} {bill.assetCategory}</strong>
                        <small>Model: {bill.model}</small>
                      </div>
                    </td>
                    <td>
                      <strong>{formatCurrency(bill.assetCost)}</strong>
                    </td>
                    <td>{formatDate(bill.createdAt)}</td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(bill.status) }}
                      >
                        {bill.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn view"
                          onClick={() => {
                            setSelectedBill(bill);
                            setShowBillModal(true);
                          }}
                          title="View Details"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                        <button
                          className="action-btn edit"
                          title="Edit Bill"
                        >
                          <Edit size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          className="action-btn download"
                          title="Download PDF"
                        >
                          <Download size={14} />
                          <span>Download</span>
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleDeleteBill(bill._id)}
                          title="Delete Bill"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Bill Details Modal */}
      {showBillModal && selectedBill && (
        <div className="modal-overlay" onClick={() => setShowBillModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Bill Details</h3>
              <button onClick={() => setShowBillModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="bill-details">
                <div className="detail-row">
                  <strong>Invoice Number:</strong>
                  <span>{selectedBill.invoiceNumber}</span>
                </div>
                <div className="detail-row">
                  <strong>Customer:</strong>
                  <span>{selectedBill.customerName}</span>
                </div>
                <div className="detail-row">
                  <strong>Address:</strong>
                  <span>{selectedBill.customerAddress}</span>
                </div>
                <div className="detail-row">
                  <strong>Product:</strong>
                  <span>{selectedBill.manufacturer} {selectedBill.assetCategory}</span>
                </div>
                <div className="detail-row">
                  <strong>Model:</strong>
                  <span>{selectedBill.model}</span>
                </div>
                <div className="detail-row">
                  <strong>Serial Number:</strong>
                  <span>{selectedBill.imeiSerialNumber || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <strong>Amount:</strong>
                  <span>{formatCurrency(selectedBill.assetCost)}</span>
                </div>
                <div className="detail-row">
                  <strong>Status:</strong>
                  <span className="status-badge" style={{ backgroundColor: getStatusColor(selectedBill.status) }}>
                    {selectedBill.status}
                  </span>
                </div>
                <div className="detail-row">
                  <strong>Created:</strong>
                  <span>{formatDate(selectedBill.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Management Modal */}
      {showStorageModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button
              onClick={() => setShowStorageModal(false)}
              className="modal-close"
              aria-label="Close storage modal"
            >
              ×
            </button>
            <h2>Storage Management</h2>
            
            {diskSpace && (
              <div style={{ marginBottom: '24px' }}>
                <h3>Disk Space Status</h3>
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '16px', 
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <p><strong>Drive:</strong> {diskSpace.drive}</p>
                  <p><strong>Usage:</strong> {diskSpace.usagePercentage}%</p>
                  <p><strong>Free Space:</strong> {
                    diskSpace.freeSpace > 1073741824 
                      ? `${(diskSpace.freeSpace / 1073741824).toFixed(1)}GB`
                      : `${(diskSpace.freeSpace / 1048576).toFixed(1)}MB`
                  }</p>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: '#e2e8f0',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${diskSpace.usagePercentage}%`,
                      height: '100%',
                      background: diskSpace.usagePercentage > 80 ? '#dc2626' : '#059669',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <h3>Data Management</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleArchive(365)}
                  style={{
                    padding: '8px 16px',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Archive Bills (1+ year old)
                </button>
                <button
                  onClick={() => handleArchive(180)}
                  style={{
                    padding: '8px 16px',
                    background: '#7c3aed',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Archive Bills (6+ months old)
                </button>
                <button
                  onClick={() => handleCleanup(365)}
                  style={{
                    padding: '8px 16px',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Delete Old Bills (1+ year)
                </button>
              </div>
            </div>

            <div style={{ 
              background: '#fef3c7', 
              padding: '12px', 
              borderRadius: '6px',
              border: '1px solid #f59e0b'
            }}>
              <p style={{ margin: 0, fontSize: '14px' }}>
                <strong>⚠️ Warning:</strong> Deleting bills is permanent and cannot be undone. 
                Consider archiving instead of deleting to preserve data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel */}
      {showDebug && (
        <div className="debug-panel">
          <h3>Debug Information</h3>
          <div className="debug-content">
            <p><strong>API Base URL:</strong> {API_BASE_URL}</p>
            <p><strong>Current Page:</strong> {currentPage}</p>
            <p><strong>Total Pages:</strong> {totalPages}</p>
            <p><strong>Bills Count:</strong> {bills.length}</p>
            <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
            <p><strong>Refreshing:</strong> {refreshing ? 'Yes' : 'No'}</p>
            <p><strong>Filters:</strong> {JSON.stringify(filters)}</p>
            <p><strong>Analytics:</strong> {JSON.stringify(analytics)}</p>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="notification-toast">
          {notification}
        </div>
      )}
    </div>
  );
};

export default Dashboard; 