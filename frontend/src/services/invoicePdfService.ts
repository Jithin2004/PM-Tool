import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanyBillingProfile, Client, Invoice, InvoiceLineItem } from './financeService';

export async function generateInvoicePDF(
  company: CompanyBillingProfile,
  client: Client,
  invoice: Invoice,
  lineItems: InvoiceLineItem[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth / 2, 20, { align: 'center' });

  // 2. Company Details (Left)
  doc.setFontSize(12);
  doc.text(company.legal_name, 14, 35);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const addressLines = doc.splitTextToSize(company.billing_address || '', 80);
  doc.text(addressLines, 14, 42);
  doc.text(`State: ${company.state} | Country: ${company.country}`, 14, 42 + (addressLines.length * 5) + 2);
  doc.text(`GSTIN: ${company.gstin || 'N/A'}`, 14, 42 + (addressLines.length * 5) + 8);
  doc.text(`PAN: ${company.pan || 'N/A'}`, 14, 42 + (addressLines.length * 5) + 14);

  // 3. Invoice Details (Right)
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice No:', 120, 35);
  doc.text('Issue Date:', 120, 42);
  doc.text('Due Date:', 120, 49);
  
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, 150, 35);
  doc.text(new Date(invoice.issue_date).toLocaleDateString(), 150, 42);
  doc.text(new Date(invoice.due_date).toLocaleDateString(), 150, 49);

  // 4. Bill To Section
  let startY = 42 + (addressLines.length * 5) + 25;
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 14, startY);
  
  doc.setFont('helvetica', 'normal');
  doc.text(client.company_name, 14, startY + 7);
  const clientAddressLines = doc.splitTextToSize(client.billing_address || '', 80);
  doc.text(clientAddressLines, 14, startY + 14);
  doc.text(`State: ${client.billing_state || 'N/A'}`, 14, startY + 14 + (clientAddressLines.length * 5) + 2);
  if (client.gstin) {
    doc.text(`GSTIN: ${client.gstin}`, 14, startY + 14 + (clientAddressLines.length * 5) + 8);
  }

  // Determine GST Mode
  const isInterState = company.state.toLowerCase().trim() !== (client.billing_state || '').toLowerCase().trim();

  // 5. Line Items Table
  const tableStartY = startY + 14 + (clientAddressLines.length * 5) + 20;
  
  const tableHead = [
    ['Description', 'Qty', 'Rate', 'Tax %', isInterState ? 'IGST' : 'CGST+SGST', 'Amount']
  ];
  
  const tableBody = lineItems.map(item => {
    const taxAmt = item.amount * (item.tax_percentage / 100);
    const taxDisplay = isInterState 
      ? `₹${taxAmt.toFixed(2)}` 
      : `₹${(taxAmt/2).toFixed(2)} + ₹${(taxAmt/2).toFixed(2)}`;
      
    return [
      item.description,
      item.quantity.toString(),
      `₹${item.rate.toFixed(2)}`,
      `${item.tax_percentage}%`,
      taxDisplay,
      `₹${(item.amount + taxAmt).toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: tableHead,
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
  });

  // 6. Financial Summary
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 130, finalY);
  doc.text(`₹${invoice.subtotal.toFixed(2)}`, 170, finalY, { align: 'right' });
  
  if (invoice.discount_amount > 0) {
    doc.text('Discount:', 130, finalY + 7);
    doc.text(`-₹${invoice.discount_amount.toFixed(2)}`, 170, finalY + 7, { align: 'right' });
  }

  const taxY = finalY + (invoice.discount_amount > 0 ? 14 : 7);
  
  if (isInterState) {
    doc.text('IGST:', 130, taxY);
    doc.text(`₹${invoice.igst_amount.toFixed(2)}`, 170, taxY, { align: 'right' });
  } else {
    doc.text('CGST:', 130, taxY);
    doc.text(`₹${invoice.cgst_amount.toFixed(2)}`, 170, taxY, { align: 'right' });
    doc.text('SGST:', 130, taxY + 7);
    doc.text(`₹${invoice.sgst_amount.toFixed(2)}`, 170, taxY + 7, { align: 'right' });
  }

  doc.setFont('helvetica', 'bold');
  const grandY = taxY + (isInterState ? 10 : 17);
  doc.text('Grand Total:', 130, grandY);
  doc.text(`₹${invoice.grand_total.toFixed(2)}`, 170, grandY, { align: 'right' });
  
  if (invoice.balance_due !== invoice.grand_total) {
    doc.setFont('helvetica', 'normal');
    doc.text('Balance Due:', 130, grandY + 7);
    doc.text(`₹${invoice.balance_due.toFixed(2)}`, 170, grandY + 7, { align: 'right' });
  }

  // 7. Bank Details & Footer
  if (company.bank_details) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Bank Details:', 14, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bank Name: ${company.bank_details.bank_name || 'N/A'}`, 14, finalY + 5);
    doc.text(`Account No: ${company.bank_details.account_number || 'N/A'}`, 14, finalY + 10);
    doc.text(`IFSC: ${company.bank_details.ifsc_code || 'N/A'}`, 14, finalY + 15);
  }

  // Save the PDF
  doc.save(`${invoice.invoice_number.replace(/\//g, '_')}_Invoice.pdf`);
}

export async function generateClientStatementPDF(
  company: CompanyBillingProfile,
  client: Client,
  invoices: Invoice[],
  payments: any[],
  creditNotes: any[],
  advances: any[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('STATEMENT OF ACCOUNT', pageWidth / 2, 20, { align: 'center' });

  // 2. Company Details
  doc.setFontSize(12);
  doc.text(company.legal_name, 14, 35);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 150, 35);
  
  // 3. Client Details
  let startY = 50;
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 14, startY);
  
  doc.setFont('helvetica', 'normal');
  doc.text(client.company_name, 14, startY + 7);
  const clientAddressLines = doc.splitTextToSize(client.billing_address || '', 80);
  doc.text(clientAddressLines, 14, startY + 14);

  // 4. Ledger Table
  const tableStartY = startY + 14 + (clientAddressLines.length * 5) + 10;
  
  const tableHead = [
    ['Date', 'Reference', 'Type', 'Debit (Inv)', 'Credit (Pay/CN)', 'Balance']
  ];
  
  // Combine and sort transactions by date
  const transactions: any[] = [];
  
  invoices.forEach(inv => {
    if (inv.status !== 'cancelled') {
      transactions.push({
        date: new Date(inv.issue_date),
        ref: inv.invoice_number,
        type: 'Invoice',
        debit: inv.grand_total || inv.amount,
        credit: 0
      });
    }
  });
  
  payments.forEach(pay => {
    transactions.push({
      date: new Date(pay.payment_date),
      ref: pay.reference_number || 'PAY',
      type: pay.method || 'Payment',
      debit: 0,
      credit: pay.amount
    });
  });
  
  creditNotes.forEach(cn => {
    transactions.push({
      date: new Date(cn.issue_date),
      ref: cn.credit_note_number,
      type: 'Credit Note',
      debit: 0,
      credit: cn.amount
    });
  });

  // Note: advances received are essentially client liabilities, they don't immediately affect the AR ledger until applied.
  // The applied advances are logged as payments, so they are covered above.

  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  let runningBalance = 0;
  const tableBody = transactions.map(t => {
    runningBalance += (t.debit - t.credit);
    return [
      t.date.toLocaleDateString(),
      t.ref,
      t.type,
      t.debit > 0 ? `₹${t.debit.toFixed(2)}` : '-',
      t.credit > 0 ? `₹${t.credit.toFixed(2)}` : '-',
      `₹${Math.max(0, runningBalance).toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: tableHead,
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
  });

  // 5. Financial Summary
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Total Outstanding Balance:', 130, finalY);
  doc.text(`₹${Math.max(0, runningBalance).toFixed(2)}`, 180, finalY, { align: 'right' });
  
  const totalAdvance = client.advance_balance || 0;
  if (totalAdvance > 0) {
    doc.text('Available Advance Balance:', 130, finalY + 8);
    doc.text(`₹${totalAdvance.toFixed(2)}`, 180, finalY + 8, { align: 'right' });
  }

  // Save the PDF
  doc.save(`${client.company_name.replace(/\s+/g, '_')}_Statement.pdf`);
}

