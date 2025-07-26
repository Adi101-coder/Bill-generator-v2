import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, Eye, Edit2, Calculator } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import './App.css';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Google Custom Search API credentials
const GOOGLE_API_KEY = 'AIzaSyCu9nP9vl7WLHoZAJBLPnd1Vb_iaN1EUgU';
const GOOGLE_CSE_ID = 'b1b1cfc37a9cb4fcf';

// Helper to detect asset category from model number using Google Custom Search API
async function detectAssetCategory(modelNo) {
  if (!modelNo) return '';
  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(modelNo)}`
    );
    const data = await response.json();
    const items = data.items || [];
    const text = items.map(item => (item.title + ' ' + item.snippet)).join(' ');
    if (/refrigerator|fridge/i.test(text)) return 'Refrigerator';
    if (/washing machine/i.test(text)) return 'Washing Machine';
    if (/air conditioner|ac\b/i.test(text)) return 'Air Conditioner';
    if (/microwave/i.test(text)) return 'Microwave';
    if (/television|tv/i.test(text)) return 'Television';
    if (/dishwasher/i.test(text)) return 'Dishwasher';
    if (/water purifier/i.test(text)) return 'Water Purifier';
    if (/fan/i.test(text)) return 'Fan';
    if (/geyser|water heater/i.test(text)) return 'Geyser';
    // Add more as needed
    return '';
  } catch (err) {
    console.error('Error detecting asset category:', err);
    return '';
  }
}

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

  // Function to convert number to words in Indian format
  const numberToWords = (amount) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const convertHundreds = (num) => {
      let words = '';
      if (typeof num !== 'number' || isNaN(num) || num < 0) return ''; 
      num = Math.floor(num); 

      if (num >= 100) {
        words += ones[Math.floor(num / 100)] + ' Hundred ';
        num %= 100;
      }
      if (num >= 20) {
        words += tens[Math.floor(num / 10)] + ' ';
        num %= 10;
      } else if (num >= 10) {
        words += teens[num - 10] + ' ';
        num = 0; 
      }
      if (num > 0) { 
        words += ones[num] + ' ';
      }
      return words; 
    };

    if (amount === 0) return 'Zero Rupees Only';
    if (typeof amount !== 'number' || isNaN(amount) || amount < 0) return ''; 
    
    const [rupeesStr, paiseStr] = amount.toFixed(2).split('.');
    let rupees = parseInt(rupeesStr, 10); 
    let paise = parseInt(paiseStr, 10); 

    let resultWords = []; 

    let crores = Math.floor(rupees / 10000000);
    rupees %= 10000000;
    if (crores > 0) {
      resultWords.push(convertHundreds(crores).trim() + ' Crore');
    }

    let lakhs = Math.floor(rupees / 100000);
    rupees %= 100000;
    if (lakhs > 0) {
      resultWords.push(convertHundreds(lakhs).trim() + ' Lakh');
    }

    let thousands = Math.floor(rupees / 1000);
    rupees %= 1000;
    if (thousands > 0) {
      resultWords.push(convertHundreds(thousands).trim() + ' Thousand');
    }

    let hundreds = rupees;
    if (hundreds > 0) {
      resultWords.push(convertHundreds(hundreds).trim());
    }
    
    let finalRupeesPart = resultWords.join(' ').trim();
    if (finalRupeesPart) {
        finalRupeesPart += ' Rupees';
    }

    let paiseWords = '';
    if (paise > 0) {
      let tempPaise = paise;
      if (tempPaise >= 20) {
        paiseWords += tens[Math.floor(tempPaise / 10)] + ' ';
        tempPaise %= 10;
      } else if (tempPaise >= 10) {
        paiseWords += teens[tempPaise - 10] + ' ';
        tempPaise = 0;
      }
      if (tempPaise > 0) { 
        paiseWords += ones[tempPaise] + ' ';
      }
      paiseWords = paiseWords.trim() + ' Paise';
    }

    let finalAmountInWords = '';
    if (finalRupeesPart && paiseWords) {
      finalAmountInWords = finalRupeesPart + ' And ' + paiseWords;
    } else if (finalRupeesPart) {
      finalAmountInWords = finalRupeesPart + ' Only';
    } else if (paiseWords) {
      finalAmountInWords = paiseWords; 
    } else { 
      finalAmountInWords = 'Zero Rupees Only'; 
    }

    return finalAmountInWords.trim();
  };

  // Helper to format numbers with commas
  function formatAmount(num) {
    if (typeof num !== 'number' || isNaN(num)) return '';
    return num.toLocaleString('en-IN');
  }

  // Helper to format numbers as Indian currency
  function formatINRCurrency(num) {
    if (typeof num !== 'number' || isNaN(num)) return '';
    return '₹ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Update extractDataFromPDF to use detectAssetCategory for assetCategory
  const extractDataFromPDF = async (file) => {
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      if (fullText.includes('HDB FINANCIAL SERVICES')) {
        // Only extract from the first page for HDB
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        fullText = textContent.items.map(item => item.str).join(' ') + ' ';
      } else {
        // Extract from all pages for other types
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(' ') + ' ';
        }
      }

      // Debug: Print the full extracted text to the console
      console.log('PDF Extracted Text:', fullText);

      const isIDFCBankDoc = fullText.includes('IDFC FIRST Bank');
      const isHDBDoc = fullText.includes('HDB FINANCIAL SERVICES');

      let customerNameMatch;
      let manufacturerMatch;
      let modelMatch;
      let assetCostMatch;
      let assetCost = 0;
      let finalCustomerName = '';
      let manufacturer = '';
      let model = '';
      let assetCategory = '';
      let customerAddress = '';
      let serialNumber = '';
      let hdbFinance = false;

      if (isHDBDoc) {
        hdbFinance = true;
        // Customer Name
        const customerRegex = /to our Customer\s+(.+?)\s+\. Pursuant/i;
        const customerMatch = fullText.match(customerRegex);
        finalCustomerName = customerMatch ? customerMatch[1].trim() : '';
        // Manufacturer
        const brandRegex = /Product Brand\s*:\s*([^\s]+)/i;
        const brandMatch = fullText.match(brandRegex);
        manufacturer = brandMatch ? brandMatch[1].trim() : '';
        // Model
        // Read the entire model number until 'Scheme Code & EMI'
        const modelStart = fullText.indexOf('Product Model :');
        const modelEnd = fullText.indexOf('Scheme Code & EMI');
        if (modelStart !== -1 && modelEnd !== -1 && modelEnd > modelStart) {
          model = fullText.substring(modelStart + 'Product Model :'.length, modelEnd).trim();
        } else {
          // fallback to previous regex if not found
          const modelRegex = /Product Model\s*:\s*([^\s]+)/i;
          const modelMatchHDB = fullText.match(modelRegex);
          model = modelMatchHDB ? modelMatchHDB[1].trim() : '';
        }
        // Asset Cost (A. Product Cost)
        // Bulletproof: Find the label, skip all whitespace/non-digits, then read the number character by character
        const label = 'A. Product Cost';
        const idx = fullText.indexOf(label);
        console.log('Index of A. Product Cost:', idx);
        if (idx !== -1) {
          let i = idx + label.length;
          // Skip all whitespace and non-digit characters
          while (i < fullText.length && !/[0-9]/.test(fullText[i])) {
            i++;
          }
          // Now read the number
          let numStr = '';
          while (i < fullText.length && /[0-9,\.]/.test(fullText[i])) {
            numStr += fullText[i];
            i++;
          }
          console.log('First non-space token after A. Product Cost:', numStr);
          if (numStr) {
            assetCost = parseFloat(numStr.replace(/,/g, ''));
          }
        }
        // Address
        const addressRegex = /Customer Address\s*:\s*([\s\S]*?\d{6})/i;
        const addressMatchHDB = fullText.match(addressRegex);
        customerAddress = addressMatchHDB ? addressMatchHDB[1].trim() : '';
        // Debug log for address
        console.log('Extracted customerAddress (HDB):', customerAddress);
        // Serial/IMEI (optional, not always present)
        // Serial Number: extract all text after 'Serial Number' up to 'Model Number'
        const serialStart = fullText.indexOf('Serial Number');
        const modelNumberStart = fullText.indexOf('Model Number', serialStart + 1);
        if (serialStart !== -1 && modelNumberStart !== -1 && modelNumberStart > serialStart) {
          serialNumber = fullText.substring(serialStart + 'Serial Number'.length, modelNumberStart).trim();
          // If the only thing found is 'cashback', ignore it
          if (/^cashback$/i.test(serialNumber) || serialNumber.length < 5) {
            serialNumber = '';
          }
        } else {
          // fallback to previous IMEI extraction if not found
          const imeiRegex = /IMEI\s*:\s*([^\s]+)/i;
          const imeiMatch = fullText.match(imeiRegex);
          serialNumber = imeiMatch ? imeiMatch[1].trim() : '';
        }
        // Asset Category: Use Google Custom Search API
        assetCategory = await detectAssetCategory(model);
        // Debug log for manufacturer and assetCategory
        console.log('Extracted manufacturer (HDB):', manufacturer);
        console.log('Extracted assetCategory (HDB):', assetCategory);
      } else if (isIDFCBankDoc) {
        // For IDFC, extract name between "loan application of" and "has been approved for"
        customerNameMatch = fullText.match(/loan application of (.+?) has been approved for/i);
        finalCustomerName = customerNameMatch ? `${customerNameMatch[1].trim()} [IDFC FIRST BANK]` : '';
        manufacturerMatch = null;
        manufacturer = '';
        // Improved Customer Address extraction for IDFC bills (based on paragraph and box)
        customerAddress = '';
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
        // fallback to previous logic if not found
        if (!customerAddress) {
          const addressMatch = fullText.match(/(?:Customer )?Address:?[ \t]*([\s\S]*?\d{6})/i);
          customerAddress = addressMatch ? addressMatch[1].trim() : '';
          customerAddress = customerAddress.replace(/^(?:Customer )?Address:?[ \t]*(.*)$/i, '$1').trim();
        }
        // Debug log for address
        console.log('Extracted customerAddress (IDFC):', customerAddress);
        const rawAssetCategoryMatch = fullText.match(/Asset Category:?[ \t]*([A-Za-z\s]+?)(?=\s*(?:Sub-Category|Variant|\bModel\b|\bSerial Number\b|\bAsset Cost\b|$))/i);
        assetCategory = rawAssetCategoryMatch ? rawAssetCategoryMatch[1].trim() : '';
        if (assetCategory.endsWith('D')) {
          assetCategory = assetCategory.slice(0, -1).trim();
        }
        modelMatch = fullText.match(/Model Number:?[ \t]*([^\n\r]+?)(?!E\s*(?:Scheme Name|Serial Number|Asset Category|\n|\r))(?=\s*(?:Scheme Name|Serial Number|Asset Category|\n|\r))/i);
        model = modelMatch ? modelMatch[1].trim() : '';
        if (model.endsWith('E')) {
          model = model.slice(0, -1).trim();
        }
        const serialNumberMatch = fullText.match(/Serial Number:?[ \t]*([^ \t\n]+)/i);
        serialNumber = serialNumberMatch ? serialNumberMatch[1].trim() : '';
        assetCostMatch = fullText.match(/Cost Of Product[\s:]*([\d,\.]+)/i);
        if (assetCostMatch) {
          assetCost = parseFloat(assetCostMatch[1].replace(/[^0-9.]/g, ''));
        }
        // Asset Category: Use Google Custom Search API
        assetCategory = await detectAssetCategory(model);
        // Debug log for manufacturer and assetCategory
        console.log('Extracted manufacturer (IDFC):', manufacturer);
        console.log('Extracted assetCategory (IDFC):', assetCategory);
      } else {
        // For Chola, extract name, manufacturer, model, asset cost, and serial number
        customerNameMatch = fullText.match(/Customer Name:?[ \t]*([A-Za-z]+(?:\s+[A-Za-z]+){0,2})/i);
        finalCustomerName = customerNameMatch ? customerNameMatch[1].trim() : '';
        // Remove trailing 'Customer' if present
        finalCustomerName = finalCustomerName.replace(/\s+Customer$/, '').trim();
        manufacturerMatch = fullText.match(/Manufacturer:?[ \t]*([^ \t\n]+)/i);
        manufacturer = manufacturerMatch ? manufacturerMatch[1].trim() : '';
        const addressMatch = fullText.match(/(?:Customer )?Address:?[ \t]*([\s\S]*?\d{6})/i);
        customerAddress = addressMatch ? addressMatch[1].trim() : '';
        customerAddress = customerAddress.replace(/^(?:Customer )?Address:?[ \t]*(.*)$/i, '$1').trim();
        // Debug log for address
        console.log('Extracted customerAddress (Chola):', customerAddress);
        const rawAssetCategoryMatch = fullText.match(/Asset Category:?[ \t]*([A-Za-z\s]+?)(?=\s*(?:Sub-Category|Variant|\bModel\b|\bSerial Number\b|\bAsset Cost\b|$))/i);
        assetCategory = rawAssetCategoryMatch ? rawAssetCategoryMatch[1].trim() : '';
        if (assetCategory.endsWith('D')) {
          assetCategory = assetCategory.slice(0, -1).trim();
        }
        modelMatch = fullText.match(/Model:?\s*([^\n\r]+?)(?=\s*Asset Category|\n|\r)/i);
        model = modelMatch ? modelMatch[1].trim() : '';
        const serialNumberMatch = fullText.match(/Serial Number:?[ \t]*([^ \t\n]+)/i);
        serialNumber = serialNumberMatch ? serialNumberMatch[1].trim() : '';
        assetCostMatch = fullText.match(/A\. Asset Cost[^\d]*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i);
        if (assetCostMatch) {
          assetCost = parseFloat(assetCostMatch[1].replace(/[^0-9.]/g, ''));
        }
        // Asset Category: Use Google Custom Search API
        assetCategory = await detectAssetCategory(model);
        // Debug log for manufacturer and assetCategory
        console.log('Extracted manufacturer (Chola):', manufacturer);
        console.log('Extracted assetCategory (Chola):', assetCategory);
      }

      // Before setting extractedData, debug assetCost and serialNumber
      console.log('Final assetCost before setExtractedData:', assetCost);
      console.log('Serial number to be set in extractedData:', serialNumber);
      const extractedData = {
        customerName: finalCustomerName,
        customerAddress: customerAddress,
        manufacturer: manufacturer,
        assetCategory: assetCategory,
        model: model,
        imeiSerialNumber: serialNumber,
        date: new Date().toISOString().split('T')[0],
        assetCost: assetCost,
        hdbFinance: hdbFinance
      };

      setExtractedData(extractedData);
    } catch (error) {
      console.error('Error extracting PDF data:', error);
      alert('Error extracting data from PDF. Please make sure the PDF is properly formatted.');
    } finally {
      setIsProcessing(false);
    }
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

    console.log('totalTaxAmount before numberToWords:', taxDetails.totalTaxAmount);

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
            <b>Serial Number:</b> ${serialToDisplay}<br>
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
    <div>
      <div className="bill-container">
        <h1 className="bill-header">Professional Bill Generator</h1>

        {/* Upload Section */}
        <div className="upload-section">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf"
            className="hidden"
          />
          <Upload style={{ width: 56, height: 56, color: '#60a5fa', marginBottom: 16 }} />
          <p style={{ color: '#2563eb', marginBottom: 16, fontSize: '1.1rem', fontWeight: 500 }}>
            Upload PDF to extract bill information
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="upload-btn"
          >
            <FileText style={{ width: 20, height: 20 }} />
            Choose PDF File
          </button>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="processing">
            <span>Processing PDF...</span>
          </div>
        )}

        {/* Extracted Data Display */}
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

            {/* Invoice Number Input */}
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

            {/* Action Buttons */}
            <div className="action-btns">
              <button
                onClick={() => setShowBillPreview(true)}
                disabled={!invoiceNumber.trim()}
                className="action-btn"
              >
                <Eye style={{ width: 20, height: 20 }} />
                Preview Bill
              </button>
              <button
                onClick={handlePrint}
                disabled={!invoiceNumber.trim()}
                className="action-btn print"
              >
                <Download style={{ width: 20, height: 20 }} />
                Print/Download
              </button>
            </div>
          </div>
        )}

        {/* Bill Preview */}
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
      </div>
      <h2 style={{ textAlign: 'center', margin: '24px 0 16px 0' }}>Professional Bill Generator</h2>
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
           style={{ marginLeft: 8, padding: '4px 12px', fontSize: '1rem', borderRadius: 4, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer' }}
           onClick={() => setAppliedSerial(manualSerial)}
         >
           Update Serial Number
         </button>
        </div>
      )}
    </div>
  );
};

export default BillGenerator;