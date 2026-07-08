import React from 'react';
import { ProductKeyGate } from '../../components/auth/ProductKeyGate';
import { navigate } from '../../lib/navigation';

export function ProductKeyPage() {
  return <ProductKeyGate onVerified={() => navigate('/')} />;
}
