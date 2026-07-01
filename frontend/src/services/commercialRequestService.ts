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
    // Reserved for future CRM/email/license request backend integration
    
    return new Promise((resolve) => {
      // Simulate network request
      setTimeout(() => {
        // Simulated logging removed for production
        resolve();
      }, 800);
    });
  }
}

export const commercialRequestService = new CommercialRequestService();
