export interface CommercialRequest {
  type: 'demo' | 'license';
  fullName: string;
  email: string;
  company: string;
  phone?: string;
  role: string;
  companySize: string;
  selectedPlan?: string;
  createdAt: string;
}

class CommercialRequestService {
  async submitRequest(request: CommercialRequest): Promise<void> {
    // TODO: Connect CRM/email/license request backend
    
    return new Promise((resolve) => {
      // Simulate network request
      setTimeout(() => {
        console.log('Simulated Commercial Request Submission:', request);
        resolve();
      }, 800);
    });
  }
}

export const commercialRequestService = new CommercialRequestService();
