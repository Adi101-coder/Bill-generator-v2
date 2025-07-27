import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, Eye, Calculator } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// Alternative: import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Analytics from './components/Analytics';
import './App.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Admin Login Component
const AdminLogin = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === 'admin123') {
      onLogin(true);
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="admin-login">
      <div className="login-card">
        <h2>Admin Login</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="password-input"
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" className="login-btn">Login</button>
        </form>
      </div>
    </div>
  );
};

// Admin Dashboard Component
const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');

  if (!isAuthenticated) {
    return <AdminLogin onLogin={setIsAuthenticated} />;
  }

  return (
    <div className="admin-app">
      <nav className="admin-nav">
        <div className="nav-brand">Admin Dashboard</div>
        <div className="nav-links">
          <button 
            className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-btn ${currentView === 'analytics' ? 'active' : ''}`}
            onClick={() => setCurrentView('analytics')}
          >
            Analytics
          </button>
          <button 
            className="nav-btn logout"
            onClick={() => setIsAuthenticated(false)}
          >
            Logout
          </button>
        </div>
      </nav>
      <main>
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'analytics' && <Analytics />}
      </main>
    </div>
  );
};

// Original Bill Generator Component
const BillGenerator = () => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBillPreview, setShowBillPreview] = useState(false);
  const fileInputRef = useRef(null);
  const [isHDBChecked, setIsHDBChecked] = useState(false);
  const [manualSerial, setManualSerial] = useState('');
  const [appliedSerial, setAppliedSerial] = useState('');
  const [isSerialUpdated, setIsSerialUpdated] = useState(false);

  const numberToWords = (amount) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (amount === 0) return 'Zero Rupees Only';
    if (typeof amount !== 'number' || isNaN(amount) || amount < 0) return ''; 
    
    const [rupeesStr, paiseStr] = amount.toFixed(2).split('.');
    let rupees = parseInt(rupeesStr, 10); 
    let paise = parseInt(paiseStr, 10); 

    let resultWords = []; 
    let crores = Math.floor(rupees / 10000000);
    rupees %= 10000000;
    if (crores > 0) resultWords.push(crores + ' Crore');

    let lakhs = Math.floor(rupees / 100000);
    rupees %= 100000;
    if (lakhs > 0) resultWords.push(lakhs + ' Lakh');

    let thousands = Math.floor(rupees / 1000);
    rupees %= 1000;
    if (thousands > 0) resultWords.push(thousands + ' Thousand');

    if (rupees > 0) resultWords.push(rupees);
    
    let finalRupeesPart = resultWords.join(' ').trim();
    if (finalRupeesPart) finalRupeesPart += ' Rupees';

    let paiseWords = '';
    if (paise > 0) {
      paiseWords = paise + ' Paise';
    }

    if (finalRupeesPart && paiseWords) {
      return finalRupeesPart + ' And ' + paiseWords;
    } else if (finalRupeesPart) {
      return finalRupeesPart + ' Only';
    } else { 
      return 'Zero Rupees Only';
    }
  };

  const formatAmount = (num) => {
    if (typeof num !== 'number' || isNaN(num)) return '';
    return num.toLocaleString('en-IN');
  };

  const extractDataFromPDF = async (file) => {
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(' ') + ' ';
      }

      const isHDBDoc = fullText.includes('HDB FINANCIAL SERVICES');
      const isIDFCBankDoc = fullText.includes('IDFC FIRST Bank');

      let customerName = '';
      let manufacturer = '';
      let model = '';
      let assetCategory = '';
      let customerAddress = '';
      let serialNumber = '';
      let assetCost = 0;
      let hdbFinance = false;

      if (isHDBDoc) {
        hdbFinance = true;
        const customerMatch = fullText.match(/to our Customer\s+(.+?)\s+\. Pursuant/i);
        customerName = customerMatch ? customerMatch[1].trim() : '';
        
        const brandMatch = fullText.match(/Product Brand\s*:\s*([^\s]+)/i);
        manufacturer = brandMatch ? brandMatch[1].trim() : '';
        
        const modelStart = fullText.indexOf('Product Model :');
        const modelEnd = fullText.indexOf('Scheme Code & EMI');
        if (modelStart !== -1 && modelEnd !== -1 && modelEnd > modelStart) {
          model = fullText.substring(modelStart + 'Product Model :'.length, modelEnd).trim();
        }
        
        const label = 'A. Product Cost';
        const idx = fullText.indexOf(label);
        if (idx !== -1) {
          let i = idx + label.length;
          while (i < fullText.length && !/[0-9]/.test(fullText[i])) i++;
          let numStr = '';
          while (i < fullText.length && /[0-9,\.]/.test(fullText[i])) {
            numStr += fullText[i];
            i++;
          }
          if (numStr) assetCost = parseFloat(numStr.replace(/,/g, ''));
        }
        
        const addressMatch = fullText.match(/Customer Address\s*:\s*([\s\S]*?\d{6})/i);
        customerAddress = addressMatch ? addressMatch[1].trim() : '';
        
        const serialStart = fullText.indexOf('Serial Number');
        const modelNumberStart = fullText.indexOf('Model Number', serialStart + 1);
        if (serialStart !== -1 && modelNumberStart !== -1 && modelNumberStart > serialStart) {
          serialNumber = fullText.substring(serialStart + 'Serial Number'.length, modelNumberStart).trim();
        }
        
        assetCategory = 'Electronics';
      } else if (isIDFCBankDoc) {
        const customerMatch = fullText.match(/loan application of (.+?) has been approved for/i);
        customerName = customerMatch ? `${customerMatch[1].trim()} [IDFC FIRST BANK]` : '';
        
        // Improved asset category extraction for IDFC bills
        const assetCategoryMatch = fullText.match(/Asset Category:?[ \t]*([A-Za-z\s]+?)(?=\s*(?:D\s*Model Number|Model Number|Serial Number|Asset Cost|$))/i);
        if (assetCategoryMatch) {
          assetCategory = assetCategoryMatch[1].trim();
          // Clean up any trailing 'D' that might be included
          if (assetCategory.endsWith('D')) {
            assetCategory = assetCategory.slice(0, -1).trim();
          }
        } else {
          // Fallback: try to find asset category between "Asset Category" and "Model Number"
          const assetCatStartIndex = fullText.indexOf('Asset Category');
          const modelNumStartIndex = fullText.indexOf('Model Number', assetCatStartIndex);
          
          if (assetCatStartIndex !== -1 && modelNumStartIndex !== -1 && modelNumStartIndex > assetCatStartIndex) {
            const textStartIndex = assetCatStartIndex + 'Asset Category'.length;
            const textEndIndex = modelNumStartIndex;
            const rawExtractedText = fullText.substring(textStartIndex, textEndIndex);
            assetCategory = rawExtractedText.trim();
            // Clean up any trailing 'D' that might be included
            if (assetCategory.endsWith('D')) {
              assetCategory = assetCategory.slice(0, -1).trim();
            }
          }
        }
        
          manufacturer = '';
        
        const para = "The required formalities with the customer have been completed and hence we request you to collect the down payment and only deliver the product at the following address post device validation is completed and final DA is received.";
        const paraIdx = fullText.indexOf(para);
        if (paraIdx !== -1) {
          const afterPara = fullText.slice(paraIdx);
          const addressIdx = afterPara.search(/Customer Address[:]?/i);
          if (addressIdx !== -1) {
            const afterAddress = afterPara.slice(addressIdx + 'Customer Address:'.length);
            const thankingIdx = afterAddress.search(/Thanking you/i);
            if (thankingIdx !== -1) {
              customerAddress = afterAddress.slice(0, thankingIdx).trim();
            } else {
              customerAddress = afterAddress.trim();
            }
          }
        }
        
        // Improved model extraction for IDFC bills
        const modelMatch = fullText.match(/Model Number:?[ \t]*([^\n\r]+?)(?=\s*(?:Scheme Name|Serial Number|Asset Category|Asset Cost|\n|\r|$))/i);
        if (modelMatch) {
          model = modelMatch[1].trim();
          // Clean up any trailing 'E' that might be included
          if (model.endsWith('E')) {
            model = model.slice(0, -1).trim();
          }
        } else {
          // Fallback: try to find model between "Model Number" and the next field
          const modelStartIndex = fullText.indexOf('Model Number');
          const schemeStartIndex = fullText.indexOf('Scheme Name', modelStartIndex);
          const serialStartIndex = fullText.indexOf('Serial Number', modelStartIndex);
          
          let modelEndIndex = -1;
          if (schemeStartIndex !== -1 && serialStartIndex !== -1) {
            modelEndIndex = Math.min(schemeStartIndex, serialStartIndex);
          } else if (schemeStartIndex !== -1) {
            modelEndIndex = schemeStartIndex;
          } else if (serialStartIndex !== -1) {
            modelEndIndex = serialStartIndex;
          }
          
          if (modelStartIndex !== -1 && modelEndIndex !== -1 && modelEndIndex > modelStartIndex) {
            const textStartIndex = modelStartIndex + 'Model Number'.length;
            const rawExtractedText = fullText.substring(textStartIndex, modelEndIndex);
            model = rawExtractedText.trim();
            // Clean up any trailing 'E' that might be included
            if (model.endsWith('E')) {
              model = model.slice(0, -1).trim();
            }
          }
        }
        
        const serialNumberMatch = fullText.match(/Serial Number:?[ \t]*([^ \t\n]+)/i);
        serialNumber = serialNumberMatch ? serialNumberMatch[1].trim() : '';
        
        const assetCostMatch = fullText.match(/Cost Of Product[\s:]*([\d,\.]+)/i);
        if (assetCostMatch) {
          assetCost = parseFloat(assetCostMatch[1].replace(/[^0-9.]/g, ''));
        }
      } else {
        const customerMatch = fullText.match(/Customer Name:?[ \t]*([A-Za-z]+(?:\s+[A-Za-z]+){0,2})/i);
        customerName = customerMatch ? customerMatch[1].trim() : '';
        customerName = customerName.replace(/\s+Customer$/, '').trim();
        
        const manufacturerMatch = fullText.match(/Manufacturer:?[ \t]*([^ \t\n]+)/i);
        manufacturer = manufacturerMatch ? manufacturerMatch[1].trim() : '';
        
        const addressMatch = fullText.match(/(?:Customer )?Address:?[ \t]*([\s\S]*?\d{6})/i);
        customerAddress = addressMatch ? addressMatch[1].trim() : '';
        customerAddress = customerAddress.replace(/^(?:Customer )?Address:?[ \t]*(.*)$/i, '$1').trim();
        
        const rawAssetCategoryMatch = fullText.match(/Asset Category:?[ \t]*([A-Za-z\s]+?)(?=\s*(?:Sub-Category|Variant|\bModel\b|\bSerial Number\b|\bAsset Cost\b|$))/i);
        assetCategory = rawAssetCategoryMatch ? rawAssetCategoryMatch[1].trim() : '';
        if (assetCategory.endsWith('D')) assetCategory = assetCategory.slice(0, -1).trim();
        
        const modelMatch = fullText.match(/Model:?\s*([^\n\r]+?)(?=\s*Asset Category|\n|\r)/i);
        model = modelMatch ? modelMatch[1].trim() : '';
        
        const serialNumberMatch = fullText.match(/Serial Number:?[ \t]*([^ \t\n]+)/i);
        serialNumber = serialNumberMatch ? serialNumberMatch[1].trim() : '';
        
        const assetCostMatch = fullText.match(/A\. Asset Cost[^\d]*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i);
        if (assetCostMatch) {
          assetCost = parseFloat(assetCostMatch[1].replace(/[^0-9.]/g, ''));
        }
      }

      const extractedData = {
        customerName,
        customerAddress,
        manufacturer,
        assetCategory,
        model,
        imeiSerialNumber: serialNumber,
        date: new Date().toISOString().split('T')[0],
        assetCost,
        hdbFinance
      };

      // Debug logging for IDFC bills
      if (isIDFCBankDoc) {
        console.log('IDFC Bill Extraction Debug:', {
          customerName,
          assetCategory,
          model,
          manufacturer,
          serialNumber,
          assetCost
        });
      }

      setExtractedData(extractedData);
      
      // Save to database
      if (invoiceNumber) {
        await saveBillToDatabase(extractedData, invoiceNumber);
      }
    } catch (error) {
      console.error('Error extracting PDF data:', error);
      alert('Error extracting data from PDF. Please make sure the PDF is properly formatted.');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveBillToDatabase = async (data, invoiceNum) => {
    try {
      const taxDetails = calculateTaxDetails(data.assetCost, data.assetCategory);
      const amountInWords = numberToWords(data.assetCost);
      const taxAmountInWords = numberToWords(parseFloat(taxDetails.totalTaxAmount));

      // Ensure required fields are not empty
      const billData = {
        invoiceNumber: invoiceNum,
        customerName: data.customerName || 'Unknown Customer',
        customerAddress: data.customerAddress || 'No Address',
        manufacturer: data.manufacturer || 'Unknown Manufacturer',
        assetCategory: data.assetCategory || 'Electronics',
        model: data.model || 'Unknown Model',
        imeiSerialNumber: data.imeiSerialNumber || '',
        assetCost: data.assetCost || 0,
        taxDetails,
        amountInWords,
        taxAmountInWords,
        hdbFinance: data.hdbFinance || false,
        status: 'generated',
        date: new Date().toISOString().split('T')[0],
        product: `${data.manufacturer || 'Unknown'} ${data.assetCategory || 'Electronics'} - ${data.model || 'Unknown'}`,
        amount: data.assetCost || 0
      };

      const response = await fetch(`${API_BASE_URL}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData)
      });

      if (response.ok) {
        console.log('Bill saved to database successfully');
        return true;
      } else {
        console.error('Failed to save bill to database');
        return false;
      }
    } catch (error) {
      console.error('Error saving bill:', error);
      return false;
    }
  };

  const handlePreviewBill = () => {
    if (!extractedData || !invoiceNumber.trim()) return;
    
    // Show preview immediately
    setShowBillPreview(true);
    
    // Save to database in the background (non-blocking)
    saveBillToDatabase(extractedData, invoiceNumber).then(success => {
      if (success) {
        console.log('Bill saved to database in background');
      } else {
        console.log('Failed to save bill to database, but preview is still shown');
      }
    });
  };

  const handlePrintDownload = () => {
    if (!extractedData || !invoiceNumber.trim()) return;
    
    // Print immediately
    handlePrint();
    
    // Save to database in the background (non-blocking)
    saveBillToDatabase(extractedData, invoiceNumber).then(success => {
      if (success) {
        console.log('Bill saved to database in background');
      } else {
        console.log('Failed to save bill to database, but print/download still works');
      }
    });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
      extractDataFromPDF(file);
    } else {
      alert('Please upload a PDF file');
    }
  };

  const calculateTaxDetails = (assetCost, assetCategory) => {
    const isAirConditioner = assetCategory.toUpperCase().includes('AIR CONDITIONER');
    const rate = isAirConditioner ? assetCost / 1.28 : assetCost / 1.18;
    const cgst = isAirConditioner ? ((assetCost - (assetCost / 1.28)) / 2) : ((assetCost - (assetCost / 1.18)) / 2);
    const sgst = cgst;
    const taxableValue = assetCost - (sgst + cgst);
    const taxRate = isAirConditioner ? 14 : 9;
    const totalTaxAmount = sgst + cgst;
    
    return {
      rate: rate.toFixed(2),
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      taxableValue: taxableValue.toFixed(2),
      taxRate,
      totalTaxAmount: totalTaxAmount.toFixed(2)
    };
  };

  const generateBillHTML = () => {
    if (!extractedData || !invoiceNumber) return '';
    const taxDetails = calculateTaxDetails(extractedData.assetCost, extractedData.assetCategory);
    const amountInWords = numberToWords(extractedData.assetCost);
    const taxAmountInWords = numberToWords(parseFloat(taxDetails.totalTaxAmount));

    // Always use appliedSerial if HDB is checked, else use extracted value
    const serialToDisplay = (isHDBChecked ? appliedSerial : extractedData.imeiSerialNumber) || '';

    return `
    <div style="width: 100%; max-width: 210mm; min-height: 297mm; margin: 0 auto; font-family: Arial, sans-serif; font-size: 9px; line-height: 1.2; box-sizing: border-box; padding: 5mm;">
      <div style="text-align:center; font-size:18px; font-weight:bold; margin-bottom:8px;">Tax Invoice</div>
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 0; table-layout: fixed;">
        <tr>
          <td rowspan="8" style="border:1px solid #000; padding:8px; width:40%; vertical-align:top; font-weight:bold; font-size:8px;">
            KATIYAR ELECTRONICS<br>
            H.I.G.J-33 VISHWABANK BARRA<br>
            KARRAHI<br>
            KANPUR NAGAR<br>
            GSTIN/UIN: 09AMTPK9751D1ZH<br>
            State Name: Uttar Pradesh, Code: 09<br>
            E-Mail: katiyars952@gmail.com<br>
            <div style="margin-left: -8px; margin-right: -8px;">
              <hr style="border: none; border-top: 1px solid #000; width: 100%; margin: 0; padding: 0;" />
            </div>
            <b>Consignee (Ship to)</b><br>
            ${extractedData.customerName}<br>
            ${extractedData.customerAddress}<br>
            <div style="margin-left: -8px; margin-right: -8px;">
              <hr style="border: none; border-top: 1px solid #000; width: 100%; margin: 0; padding: 0;" />
            </div>
            <b>Buyer (Bill to)</b><br>
            ${extractedData.customerName}<br>
            ${extractedData.customerAddress}
          </td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; width:50%; font-size:8px; text-align:center;">Invoice No.<div style='height:5px;'></div><div>${invoiceNumber}</div></td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; width:50%; font-size:8px; text-align:center;">Dated<div style='height:5px;'></div><div>${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div></td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; font-size:8px; text-align:center; width:50%;">Delivery Note<div style='height:5px;'></div></td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; font-size:8px; text-align:center; width:50%;"></td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; font-size:8px; text-align:center; width:50%;">Buyer's Order No.<div style='height:5px;'></div></td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; font-size:8px; text-align:center; width:50%;">Dated<div style='height:5px;'></div></td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; font-size:8px; text-align:center; width:50%;">Dispatch Doc No.<div style='height:5px;'></div></td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; font-size:8px; text-align:center; width:50%;">Delivery Note Date<div style='height:5px;'></div></td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; font-size:8px; text-align:center; width:50%;">Dispatched through<div style='height:5px;'></div></td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; font-size:8px; text-align:center; width:50%;">Destination<div style='height:5px;'></div></td>
        </tr>
        <tr>
          <td colspan="2" style="border:1px solid #000; padding:8px; font-size:8px;"></td>
        </tr>
      </table>
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-top:0; margin-bottom: 0;">
        <tr style="background-color: #f0f0f0;">
          <td style="border: 1px solid #000; text-align: center; width: 4%; padding: 2px; font-size:8px;"><strong>Sl</strong></td>
          <td style="border: 1px solid #000; text-align: center; width: 40%; padding: 2px; font-size:8px;"><strong>Description of Goods</strong></td>
          <td style="border: 1px solid #000; text-align: center; width: 12%; padding: 2px; font-size:8px;"><strong>HSN/SAC</strong></td>
          <td style="border: 1px solid #000; text-align: center; width: 8%; padding: 2px; font-size:8px;"><strong>Quantity</strong></td>
          <td style="border: 1px solid #000; text-align: center; width: 12%; padding: 2px; font-size:8px;"><strong>Rate</strong></td>
          <td style="border: 1px solid #000; text-align: center; width: 4%; padding: 2px; font-size:8px;"><strong>per</strong></td>
          <td style="border: 1px solid #000; text-align: center; width: 20%; padding: 2px; font-size:8px;"><strong>Amount</strong></td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;">1</td>
          <td style="border: 1px solid #000; vertical-align: top; padding: 4px; font-size:8px;">
            <strong>${extractedData.manufacturer} ${extractedData.assetCategory}</strong><br><br>
            <strong>Model No:</strong> ${extractedData.model}<br>
            ${serialToDisplay ? `<b>Serial Number:</b> ${serialToDisplay}<br>` : ''}
            <div style="display: flex; justify-content: space-between; margin-top: 4px;">
              <div><strong>CGST</strong></div>
              <div>${formatAmount(Number(taxDetails.cgst))}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0;">
              <div><strong>SGST</strong></div>
              <div>${formatAmount(Number(taxDetails.sgst))}</div>
            </div>
            <div style="height: 350px;"></div>
          </td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;">1 PCS</td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;">${formatAmount(Number(taxDetails.rate))}</td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;">PCS</td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;">${formatAmount(Number(taxDetails.rate))}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; text-align: right; padding: 2px; font-size:8px;" colspan="6"><strong>Total</strong></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"><strong>₹ ${formatAmount(Number(extractedData.assetCost))}</strong></td>
        </tr>
      </table>
      <table style="width: 100%; border-collapse: collapse; border-left: 1.5px solid #000; border-right: 1.5px solid #000; margin: 0;">
        <tr>
          <td style="border-left: 1px solid #000; border-right: none; border-top: none; border-bottom: none; width: 1%;"></td>
          <td style="border: none; font-size:8px; padding: 4px;">
            <strong>Amount Chargeable (in words)</strong><br>
            <strong>INR ${amountInWords}</strong>
          </td>
          <td style="border-right: 1px solid #000; border-left: none; border-top: none; border-bottom: none; width: 1%;"></td>
        </tr>
      </table>
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 4px;">
        <tr style="background-color: #f0f0f0;">
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;" rowspan="2"><strong>HSN/SAC</strong></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;" rowspan="2"><strong>Taxable Value</strong></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;" colspan="2"><strong>Central Tax</strong></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;" colspan="2"><strong>State Tax</strong></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;" rowspan="2"><strong>Total Tax Amount</strong></td>
        </tr>
        <tr style="background-color: #f0f0f0;">
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"><strong>Rate</strong></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"><strong>Amount</strong></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"><strong>Rate</strong></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"><strong>Amount</strong></td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;">${formatAmount(Number(taxDetails.taxableValue))}</td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;">${taxDetails.taxRate}%</td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;">${formatAmount(Number(taxDetails.cgst))}</td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;">${taxDetails.taxRate}%</td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;">${formatAmount(Number(taxDetails.sgst))}</td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;">${formatAmount(Number(taxDetails.totalTaxAmount))}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"><strong>Total</strong></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"><strong>${formatAmount(Number(taxDetails.taxableValue))}</strong></td>
          <td style="border: 1px solid #000; padding: 2px; font-size:8px;"></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"><strong>${formatAmount(Number(taxDetails.cgst))}</strong></td>
          <td style="border: 1px solid #000; padding: 2px; font-size:8px;"></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"><strong>${formatAmount(Number(taxDetails.sgst))}</strong></td>
          <td style="border: 1px solid #000; text-align: center; padding: 2px; font-size:8px;"><strong>${formatAmount(Number(taxDetails.totalTaxAmount))}</strong></td>
        </tr>
        <tr>
          <td colspan="7" style="border-left: 1.5px solid #000; border-right: 1.5px solid #000; border-top: none; border-bottom: none; font-size:8px; padding: 4px 0; text-align:center;">
            <strong>Tax Amount (in words): INR ${taxAmountInWords}</strong>
          </td>
        </tr>
      </table>
      ${extractedData.hdbFinance ? `<tr><td colspan="6" style="font-weight:bold; text-align:center; color:#1a237e; font-size:10px;">FINANCE BY HDBFS</td></tr>` : ''}
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 4px;">
        <tr>
          <td style="border: 1px solid #000; width: 50%; vertical-align: top; padding: 4px; font-size:8px;">
            <strong>Declaration</strong><br>
            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
          </td>
          <td style="border: 1px solid #000; width: 25%; vertical-align: top; padding: 4px; font-size:8px;">
            <strong>Pre Authenticated by</strong><br><br>
            Authorised Signatory<br>
            Name:<br>
            Designation:
          </td>
          <td style="border: 1px solid #000; width: 25%; vertical-align: top; text-align: center; padding: 4px; font-size:8px;">
            <strong>for KATIYAR ELECTRONICS</strong><br><br>
            Authorised Signatory<br>
            Name:<br>
            Designation:
          </td>
        </tr>
      </table>
      <div style="text-align: center; font-size: 8px; margin-top: 4px;">
        <strong>SUBJECT TO KANPUR JURISDICTION</strong><br>
        This is a Computer Generated Invoice
      </div>
    </div>
    `;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Tax Invoice</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              @page { 
                size: A4; 
                margin: 10mm; 
              }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body>
          ${generateBillHTML()}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
      <div className="bill-container">
        <h1 className="bill-header">Professional Bill Generator</h1>

        <div className="upload-section">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf"
          />
        <p style={{ color: '#2563eb', marginTop: 16, fontSize: '1.1rem', fontWeight: 500 }}>
            Upload PDF to extract bill information
          </p>
        </div>

        {isProcessing && (
          <div className="processing">
            <span>Processing PDF...</span>
          </div>
        )}

        {extractedData && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 16, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calculator style={{ width: 24, height: 24 }} />
              Extracted Information
            </h2>
            <div className="info-card">
              <div><strong>Customer Name:</strong> {extractedData.customerName}</div>
              <div><strong>Manufacturer:</strong> {extractedData.manufacturer}</div>
              <div className="full"><strong>Customer Address:</strong> {extractedData.customerAddress}</div>
              <div><strong>Asset Category:</strong> {extractedData.assetCategory}</div>
              <div><strong>Model:</strong> {extractedData.model}</div>
              <div><strong>Serial Number:</strong> {extractedData.imeiSerialNumber}</div>
              <div><strong>Asset Cost:</strong> ₹{extractedData.assetCost.toFixed(2)}</div>
            </div>

            <div style={{ marginTop: 32 }}>
              <label className="input-label">Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Enter invoice number"
                className="input-box"
              />
            </div>

            <div className="action-btns">
              <button
              onClick={handlePreviewBill}
                disabled={!invoiceNumber.trim()}
              style={{
                background: '#059669',
                color: '#fff',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                marginRight: '12px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!e.target.disabled) {
                  e.target.style.background = '#047857';
                  e.target.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#059669';
                e.target.style.transform = 'translateY(0)';
              }}
            >
                Preview Bill
              </button>
              <button
              onClick={handlePrintDownload}
                disabled={!invoiceNumber.trim()}
              style={{
                background: '#2563eb',
                color: '#fff',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!e.target.disabled) {
                  e.target.style.background = '#1d4ed8';
                  e.target.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#2563eb';
                e.target.style.transform = 'translateY(0)';
              }}
            >
                Print/Download
              </button>
            </div>
          </div>
        )}

        {showBillPreview && extractedData && invoiceNumber && (
          <div className="modal-overlay">
            <div className="modal-content">
              <button
                onClick={() => setShowBillPreview(false)}
                className="modal-close"
                aria-label="Close preview"
              >
                ×
              </button>
              <div
                style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, overflow: 'auto', maxHeight: '70vh' }}
                dangerouslySetInnerHTML={{ __html: generateBillHTML() }}
              />
            </div>
          </div>
        )}

      <h2 style={{ textAlign: 'center', margin: '24px 0 16px 0' }}>Professional Bill Generator</h2>
      <div style={{ textAlign: 'center', margin: '16px 0' }}>
        <a 
          href="/admin" 
          style={{ 
            color: '#2563eb', 
            textDecoration: 'none', 
            padding: '8px 16px', 
            border: '1px solid #2563eb', 
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          Admin Dashboard
        </a>
      </div>
      <div style={{ margin: '16px 0', textAlign: 'center' }}>
        <label>
          <input
            type="checkbox"
            checked={isHDBChecked}
            onChange={e => setIsHDBChecked(e.target.checked)}
          />{' '}
          Is this an HDB bill?
        </label>
      </div>
      {isHDBChecked && (
        <div style={{ margin: '16px 0', textAlign: 'center' }}>
          <label htmlFor="manual-serial-input" style={{ marginRight: 8 }}>
            Enter Serial Number (if not auto-extracted):
          </label>
          <input
            id="manual-serial-input"
            type="text"
            value={manualSerial}
            onChange={e => setManualSerial(e.target.value)}
            placeholder="Enter serial number"
            style={{ padding: '4px 8px', fontSize: '1rem', borderRadius: 4, border: '1px solid #ccc', minWidth: 180 }}
          />
         <button
           style={{ 
             marginLeft: 8, 
             padding: '4px 12px', 
             fontSize: '1rem', 
             borderRadius: 4, 
             border: `1px solid ${isSerialUpdated ? '#059669' : '#2563eb'}`, 
             background: isSerialUpdated ? '#059669' : '#2563eb', 
             color: '#fff', 
             cursor: 'pointer',
             transition: 'all 0.2s ease-in-out',
             transform: 'scale(1)',
             boxShadow: isSerialUpdated ? '0 2px 4px rgba(5, 150, 105, 0.2)' : '0 2px 4px rgba(37, 99, 235, 0.2)'
           }}
           onClick={(e) => {
             e.target.style.transform = 'scale(0.95)';
             e.target.style.background = isSerialUpdated ? '#047857' : '#1d4ed8';
             e.target.style.boxShadow = isSerialUpdated ? '0 1px 2px rgba(5, 150, 105, 0.3)' : '0 1px 2px rgba(37, 99, 235, 0.3)';
             
             setTimeout(() => {
               e.target.style.transform = 'scale(1)';
               e.target.style.background = isSerialUpdated ? '#059669' : '#2563eb';
               e.target.style.boxShadow = isSerialUpdated ? '0 2px 4px rgba(5, 150, 105, 0.2)' : '0 2px 4px rgba(37, 99, 235, 0.2)';
             }, 150);
             
             setAppliedSerial(manualSerial);
             setIsSerialUpdated(true);
           }}
           onMouseEnter={(e) => {
             e.target.style.transform = 'scale(1.05)';
             e.target.style.boxShadow = isSerialUpdated ? '0 4px 8px rgba(5, 150, 105, 0.3)' : '0 4px 8px rgba(37, 99, 235, 0.3)';
           }}
           onMouseLeave={(e) => {
             e.target.style.transform = 'scale(1)';
             e.target.style.boxShadow = isSerialUpdated ? '0 2px 4px rgba(5, 150, 105, 0.2)' : '0 2px 4px rgba(37, 99, 235, 0.2)';
           }}
                    >
             {isSerialUpdated ? '✓ Serial Updated' : 'Update Serial Number'}
           </button>
        </div>
      )}
    </div>
  );
};

// Main App Component with Routing
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BillGenerator />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App; 