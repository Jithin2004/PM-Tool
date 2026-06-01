import { activityLogService } from './activityLogService';

/**
 * Enterprise PDF Export Service
 * Simulates server-side generation via Edge Function / Puppeteer.
 */
export const exportToPDF = async (
  workspaceId: string,
  reportType: 'ExecutiveDigest' | 'PortfolioReport' | 'CapacityReport' | 'DeliveryHealth',
  data: any
) => {
  // Track in observability
  activityLogService.appendLog({
    workspace_id: workspaceId,
    actor_id: 'system',
    action: 'pdf_generation_started',
    metadata: { reportType }
  }).catch(() => {});

  // Simulate network delay for server-side generation
  await new Promise(resolve => setTimeout(resolve, 1500));

  // In a real environment, this would call a Supabase Edge Function:
  // const { data: pdfBlob, error } = await supabase.functions.invoke('generate-pdf', { body: { reportType, data } });
  
  // Here we mock a successful generation and trigger a download of a placeholder
  const mockContent = `Mock PDF Content for ${reportType}\nData: ${JSON.stringify(data).substring(0, 50)}...`;
  const blob = new Blob([mockContent], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

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
