require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL) {
    console.error('FRONTEND_URL environment variable is mandatory.');
    process.exit(1);
}
app.use(cors({ origin: FRONTEND_URL }));

app.use(express.json());

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in auth-admin environment.');
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const provisionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per window
    message: { error: 'Too many employee creation attempts, please try again later' }
});

// Endpoint to provision a new enterprise employee
app.post('/api/provision-employee', provisionLimiter, async (req, res) => {
    try {
        // 1. Require Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }
        const token = authHeader.split(' ')[1];

        // 2. Verify JWT
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // 3. Fetch requester from public.users
        const { data: requester, error: requesterError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (requesterError || !requester) {
            return res.status(403).json({ error: 'Requester profile not found' });
        }

        // 4. Allow provisioning ONLY IF requester.role IN ['super_admin', 'admin', 'hr']
        const allowedRoles = ['super_admin', 'admin', 'hr'];
        if (!allowedRoles.includes(requester.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to provision users' });
        }

        let { email, role, date_of_joining, full_name } = req.body;

        // TASK 3: Validate employee input
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Missing required field: email' });
        }
        email = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (full_name !== undefined) {
            if (typeof full_name !== 'string') {
                return res.status(400).json({ error: 'full_name must be a string' });
            }
            full_name = full_name.trim();
        }

        if (date_of_joining !== undefined && date_of_joining !== null && date_of_joining !== '') {
            if (isNaN(Date.parse(date_of_joining))) {
                return res.status(400).json({ error: 'Invalid date_of_joining format' });
            }
        }

        const targetRole = role || 'developer';

        // TASK 2: Strict role validation whitelist
        const allowedTargetRoles = ['super_admin', 'admin', 'hr', 'pm', 'developer'];
        if (!allowedTargetRoles.includes(targetRole)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // 6. Role escalation protection
        if (targetRole === 'super_admin' && requester.role !== 'super_admin') {
            return res.status(403).json({ error: 'Only super_admin can create super_admin' });
        }
        if (requester.role === 'hr' && ['super_admin', 'admin', 'hr'].includes(targetRole)) {
            return res.status(403).json({ error: 'HR can only provision normal employees' });
        }

        // 5. Derive trusted fields
        const workspace_id = requester.workspace_id;
        const invited_by = requester.id;

        // 8. Generate cryptographically secure temporary password
        // base64 produces a secure random string (e.g. 16 bytes = ~22 chars)
        const tempPassword = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) + '!A1';

        // Create Supabase Auth User using Admin API
        const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: full_name || '' }
        });

        if (createUserError) {
            if (createUserError.message.includes('already registered')) {
                return res.status(409).json({ error: 'User already exists' });
            }
            throw createUserError;
        }

        const userId = authUser.user.id;

        // Create public.users row
        const { error: dbError } = await supabaseAdmin.from('users').insert({
            id: userId,
            email: email,
            role: targetRole,
            workspace_id: workspace_id,
            invited_by: invited_by,
            date_of_joining: date_of_joining || new Date().toISOString(),
            status: 'active',
            force_password_change: true,
            full_name: full_name || email.split('@')[0]
        });

        if (dbError) {
            // Rollback auth user creation if db insertion fails
            await supabaseAdmin.auth.admin.deleteUser(userId);
            throw dbError;
        }

        // Return temp password ONCE
        return res.status(200).json({ 
            success: true, 
            message: 'Employee provisioned successfully', 
            user_id: userId,
            tempPassword: tempPassword
        });

    } catch (error) {
        console.error('Provisioning error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Enterprise Auth Provisioning API running on port ${PORT}`);
});
