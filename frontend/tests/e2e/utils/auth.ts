export async function provisionTestEmployee(token: string, role: string = 'developer') {
  const timestamp = Date.now();
  const email = `test.emp.${timestamp}@example.com`;
  const fullName = `Test Employee ${timestamp}`;

  const res = await fetch('http://localhost:5001/api/provision-employee', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      email,
      role,
      full_name: fullName
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to provision test employee: ${data.error}`);
  }

  return { email, password: data.tempPassword, userId: data.user_id, fullName };
}
