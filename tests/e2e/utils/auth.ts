export async function provisionTestEmployee(token: string, role: string = 'developer') {
  const timestamp = Date.now();
  const email = `test.emp.${timestamp}@example.com`;
  const fullName = `Test Employee ${timestamp}`;

  const res = await fetch(`${process.env.TEST_API_URL}/api/invite`, {
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

  return { email, password: 'AcceptInvitePassword123!', userId: data.data?.user_id, fullName, inviteLink: data.data?.invite_link };
}
