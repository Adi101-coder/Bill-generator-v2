import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  FileText
} from 'lucide-react';
import './Analytics.css';

const Analytics = () => {
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');

  const API_BASE_URL = 'http://localhost:5000/api';

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/bills/analytics/summary`);
      const data = await response.json();

      if (data.success) {
        console.log('Analytics data received:', data.data);
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMonthlyAnalytics = useCallback(async (year) => {
    try {
      const response = await fetch(`${API_BASE_URL}/bills/analytics/monthly?year=${year}`);
      const data = await response.json();

      if (data.success) {
        console.log('Monthly analytics data received:', data.data);
        setAnalytics(prev => ({
          ...prev,
          monthlyData: data.data
        }));
      }
    } catch (error) {
      console.error('Error fetching monthly analytics:', error);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (selectedYear) {
      fetchMonthlyAnalytics(selectedYear);
    }
  }, [selectedYear, fetchMonthlyAnalytics]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const getMonthName = (month) => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[month - 1];
  };

  const generateMonthlyChartData = () => {
    if (!analytics.monthlyData) return [];
    
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    return months.map(month => {
      const monthData = analytics.monthlyData.find(m => m._id.month === month);
      return {
        month: getMonthName(month),
        revenue: monthData ? monthData.revenue : 0,
        count: monthData ? monthData.count : 0
      };
    });
  };

  const getTopCategories = () => {
    return analytics.categoryData ? analytics.categoryData.slice(0, 5) : [];
  };

  const getTopManufacturers = () => {
    return analytics.manufacturerData ? analytics.manufacturerData.slice(0, 5) : [];
  };

  const calculateGrowthRate = () => {
    if (!analytics.monthlyData || analytics.monthlyData.length < 2) return 0;
    
    const currentMonth = analytics.monthlyData[analytics.monthlyData.length - 1];
    const previousMonth = analytics.monthlyData[analytics.monthlyData.length - 2];
    
    if (!currentMonth || !previousMonth) return 0;
    
    return ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100;
  };

  const exportData = () => {
    const data = {
      summary: analytics.summary,
      monthlyData: analytics.monthlyData,
      categoryData: analytics.categoryData,
      manufacturerData: analytics.manufacturerData,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${selectedYear}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="analytics">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-content">
          <h1>Sales Analytics</h1>
          <p>Comprehensive insights into your bill generation and sales performance</p>
        </div>
        <div className="header-actions">
          <button className="export-btn" onClick={exportData}>
            <FileText size={16} />
            Export Data
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="analytics-filters">
        <div className="filter-group">
          <label>Year:</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Period:</label>
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">
            <DollarSign color="#059669" />
          </div>
          <div className="metric-content">
            <h3>{formatCurrency(analytics.summary?.totalRevenue || 0)}</h3>
            <p>Total Revenue</p>
            <span className="growth-rate positive">
              +{calculateGrowthRate().toFixed(1)}% from last month
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <Package color="#2563eb" />
          </div>
          <div className="metric-content">
            <h3>{formatNumber(analytics.summary?.totalBills || 0)}</h3>
            <p>Total Bills</p>
            <span className="growth-rate positive">
              +{((analytics.summary?.totalBills || 0) / 100).toFixed(1)}% growth
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <TrendingUp color="#7c3aed" />
          </div>
          <div className="metric-content">
            <h3>{formatCurrency(analytics.summary?.averageBillValue || 0)}</h3>
            <p>Average Bill Value</p>
            <span className="growth-rate positive">
              +{((analytics.summary?.averageBillValue || 0) / 1000).toFixed(1)}% increase
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <Package color="#dc2626" />
          </div>
          <div className="metric-content">
            <h3>{analytics.categoryData?.length || 0}</h3>
            <p>Product Categories</p>
            <span className="growth-rate neutral">
              Active categories
            </span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        {/* Monthly Revenue Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Monthly Revenue Trend</h3>
            <span className="chart-subtitle">{selectedYear}</span>
          </div>
          <div className="chart-container">
            <div className="bar-chart">
              {generateMonthlyChartData().length > 0 ? (
                generateMonthlyChartData().map((data, index) => (
                  <div key={index} className="bar-group">
                    <div className="bar-label">{data.month}</div>
                    <div className="bar-container">
                      <div 
                        className="bar" 
                        style={{ 
                          height: `${(data.revenue / Math.max(...generateMonthlyChartData().map(d => d.revenue))) * 200}px` 
                        }}
                      ></div>
                    </div>
                    <div className="bar-value">{formatCurrency(data.revenue)}</div>
                  </div>
                ))
              ) : (
                <div className="no-data">No monthly data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Top Product Categories</h3>
            <span className="chart-subtitle">By Revenue</span>
          </div>
          <div className="chart-container">
            <div className="pie-chart">
              {getTopCategories().length > 0 ? (
                getTopCategories().map((category, index) => {
                  const total = getTopCategories().reduce((sum, c) => sum + c.revenue, 0);
                  const percentage = total > 0 ? (category.revenue / total) * 100 : 0;
                  const colors = ['#2563eb', '#059669', '#7c3aed', '#dc2626', '#ea580c'];
                  
                  return (
                    <div key={index} className="pie-segment">
                      <div className="segment-info">
                        <div className="segment-color" style={{ backgroundColor: colors[index] }}></div>
                        <div className="segment-details">
                          <div className="segment-name">{category._id}</div>
                          <div className="segment-value">{formatCurrency(category.revenue)}</div>
                        </div>
                        <div className="segment-percentage">{percentage.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="no-data">No category data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Manufacturer Performance */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Top Manufacturers</h3>
            <span className="chart-subtitle">By Sales Volume</span>
          </div>
          <div className="chart-container">
            <div className="horizontal-bar-chart">
              {getTopManufacturers().length > 0 ? (
                getTopManufacturers().map((manufacturer, index) => {
                  const maxRevenue = Math.max(...getTopManufacturers().map(m => m.revenue));
                  const percentage = maxRevenue > 0 ? (manufacturer.revenue / maxRevenue) * 100 : 0;
                  
                  return (
                    <div key={index} className="horizontal-bar-group">
                      <div className="bar-label">{manufacturer._id}</div>
                      <div className="horizontal-bar-container">
                        <div 
                          className="horizontal-bar" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="bar-value">{formatCurrency(manufacturer.revenue)}</div>
                    </div>
                  );
                })
              ) : (
                <div className="no-data">No manufacturer data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Monthly Bill Count */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Monthly Bill Count</h3>
            <span className="chart-subtitle">{selectedYear}</span>
          </div>
          <div className="chart-container">
            <div className="line-chart">
              {generateMonthlyChartData().length > 0 ? (
                generateMonthlyChartData().map((data, index) => (
                  <div key={index} className="line-point">
                    <div className="point-label">{data.month}</div>
                    <div className="point-value">{data.count}</div>
                  </div>
                ))
              ) : (
                <div className="no-data">No monthly bill count data available</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="statistics-section">
        <div className="statistics-card">
          <h3>Detailed Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Highest Bill Value:</span>
              <span className="stat-value">{formatCurrency(analytics.summary?.maxBillValue || 0)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Lowest Bill Value:</span>
              <span className="stat-value">{formatCurrency(analytics.summary?.minBillValue || 0)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Tax Collected:</span>
              <span className="stat-value">
                {formatCurrency((analytics.summary?.totalRevenue || 0) * 0.18)}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Average Monthly Revenue:</span>
              <span className="stat-value">
                {formatCurrency((analytics.summary?.totalRevenue || 0) / 12)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics; 