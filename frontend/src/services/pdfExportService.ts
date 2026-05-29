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
