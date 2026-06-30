const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ctizplvjglydyrjqaalx.supabase.co';

// IMPORTANT: Use your SERVICE ROLE KEY,
// NOT the anon key.
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aXpwbHZqZ2x5ZHlyanFhYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQyMzE3MSwiZXhwIjoyMDkzOTk5MTcxfQ.q_kpv-kvWl2R16oHpwfoc5J7Uo-s_jTiu-_qkRbdt3k';

const KEEP_EMAIL = 'jithinragesh@gmail.com';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
    let page = 1;
    const perPage = 1000;
    let deleted = 0;

    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({
            page,
            perPage,
        });

        if (error) throw error;

        const users = data.users;

        if (!users.length) break;

        for (const user of users) {
            if (user.email === KEEP_EMAIL) {
                console.log(`Keeping ${user.email}`);
                continue;
            }

            console.log(`Deleting ${user.email}`);

            const { error: deleteError } =
                await supabase.auth.admin.deleteUser(user.id);

            if (deleteError) {
                console.error({
                    email: user.email,
                    status: deleteError?.status,
                    code: deleteError?.code,
                    name: deleteError?.name,
                    message: deleteError?.message,
                    error: deleteError
                });
            } else {
                deleted++;
            }
        }

        if (users.length < perPage) break;
        page++;
    }

    console.log(`\nDeleted ${deleted} users.`);
}

main().catch(console.error);