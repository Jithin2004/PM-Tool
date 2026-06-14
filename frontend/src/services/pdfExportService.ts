import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { activityLogService } from './activityLogService';
import { supabase } from '../lib/supabase';

/**
 * Enterprise PDF Export Service
 * Generates client-side PDF using jsPDF.
 */
export const exportToPDF = async (
  workspaceId: string,
  reportType: string,
  dataRaw: any
) => {
  // Track in observability
  activityLogService.appendLog({
    workspace_id: workspaceId,
    actor_id: 'system',
    action: 'pdf_generation_started',
    metadata: { reportType }
  }).catch(() => {});

  const doc = new jsPDF();
  const title = `${reportType.replace(/_/g, ' ')}`;
  
  // Fetch company branding
  const { data: companyProfile } = await supabase
    .from('company_billing_profiles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (companyProfile) {
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55); // Dark gray
    doc.text(companyProfile.legal_name, 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Muted gray
    doc.text(`${companyProfile.billing_address || ''}, ${companyProfile.state}, ${companyProfile.country}`, 14, 28);
    if (companyProfile.gstin) {
      doc.text(`GSTIN: ${companyProfile.gstin}`, 14, 33);
    }
    
    doc.setDrawColor(229, 231, 235);
    doc.line(14, 38, 196, 38);
    
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text(title, 14, 48);
    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 53);
  } else {
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
  }

  const data = dataRaw?.data || dataRaw; // handle wrapper object if present

  if (Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0]);
    const body = data.map(row => headers.map(h => String(row[h] || '')));
    
    (doc as any).autoTable({
      startY: companyProfile ? 60 : 40,
      head: [headers],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55] }, // Dark header
    });
  } else {
    doc.text('No data available for this report.', 14, companyProfile ? 60 : 40);
  }

  doc.save(`${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);

  // Track success
  activityLogService.appendLog({
    workspace_id: workspaceId,
    actor_id: 'system',
    action: 'pdf_generation_completed',
    metadata: { reportType, success: true }
  }).catch(() => {});

  return true;
};

export const exportToCSV = async (
  workspaceId: string,
  reportType: string,
  data: any[]
) => {
  activityLogService.appendLog({
    workspace_id: workspaceId,
    actor_id: 'system',
    action: 'csv_generation_started',
    metadata: { reportType }
  }).catch(() => {});

  await new Promise(resolve => setTimeout(resolve, 800));

  let csvContent = "";
  if (data && data.length > 0) {
    const headers = Object.keys(data[0]);
    csvContent += headers.join(",") + "\n";
    data.forEach(row => {
      const values = headers.map(h => {
        const val = row[h];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      });
      csvContent += values.join(",") + "\n";
    });
  } else {
    csvContent = "No data available";
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  activityLogService.appendLog({
    workspace_id: workspaceId,
    actor_id: 'system',
    action: 'csv_generation_completed',
    metadata: { reportType, success: true }
  }).catch(() => {});

  return true;
};
