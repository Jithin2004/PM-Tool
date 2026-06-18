require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: '*' })); // Allow all origins for dev, restrict in prod
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
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: { error: 'Too many requests, please try again later' }
});

// Helper: Verify Admin/HR requester
async function verifyRequester(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid Authorization header');
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid or expired token');

    const { data: requester, error: requesterError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (requesterError || !requester) throw new Error('Requester profile not found');

    const allowedRoles = ['super_admin', 'admin', 'hr', 'pm'];
    if (!allowedRoles.includes(requester.role)) {
        throw new Error('Insufficient permissions to provision users');
    }

    return requester;
}

// Core Invite Engine Function
async function processInvite(userData, requester, source) {
    let { email, role, department, full_name, capabilities, designation } = userData;
    email = email.trim().toLowerCase();
    const targetRole = role || 'developer';

    // 1. Role escalation protection
    if (targetRole === 'super_admin' && requester.role !== 'super_admin') {
        throw new Error(`Cannot invite super_admin`);
    }

    // 2. Generate secure token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 7); // 7 days expiration

    // 3. Create Auth User Passwordless
    const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true, // Auto-confirm email so they can log in once password is set
        user_metadata: { full_name: full_name || '' }
    });

    if (createUserError) {
        if (createUserError.message.includes('already registered') || createUserError.message.includes('already exists')) {
            throw new Error(`User ${email} already exists`);
        }
        throw createUserError;
    }

    const userId = authUser.user.id;

    // 4. Create public.users row
    const { error: dbError } = await supabaseAdmin.from('users').insert({
        id: userId,
        email: email,
        role: targetRole,
        department: department || null,
        designation: designation || null,
        capabilities: Array.isArray(capabilities) ? capabilities : null,
        workspace_id: requester.workspace_id,
        invited_by: requester.id,
        status: 'invited',
        invite_token: inviteToken,
        invite_expires_at: inviteExpiresAt.toISOString(),
        invite_source: source,
        full_name: full_name || email.split('@')[0]
    });

    if (dbError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw dbError;
    }

    return {
        email,
        invite_link: `${FRONTEND_URL}/accept-invite/${inviteToken}`
    };
}

// ==========================================
// ENDPOINT: SINGLE INVITE
// ==========================================
app.post('/api/invite', provisionLimiter, async (req, res) => {
    try {
        const requester = await verifyRequester(req);
        const { email, role, department, full_name, capabilities, designation, source = 'manual' } = req.body;

        if (!email) return res.status(400).json({ error: 'Email is required' });

        const result = await processInvite({ email, role, department, full_name, capabilities, designation }, requester, source);

        return res.status(200).json({ 
            success: true, 
            message: 'Employee invited successfully', 
            data: result
        });
    } catch (error) {
        console.error('Invite error:', error);
        return res.status(400).json({ error: error.message || 'Internal server error' });
    }
});

// ==========================================
// ENDPOINT: BULK INVITE
// ==========================================
app.post('/api/bulk-invite', provisionLimiter, async (req, res) => {
    try {
        const requester = await verifyRequester(req);
        const { users, source = 'bulk_import' } = req.body;

        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ error: 'Users array is required' });
        }

        const results = [];
        const errors = [];

        for (const user of users) {
            try {
                const resData = await processInvite(user, requester, source);
                results.push(resData);
            } catch (e) {
                errors.push({ email: user.email, error: e.message });
            }
        }

        return res.status(200).json({ 
            success: true, 
            message: `Processed ${users.length} invitations`, 
            results,
            errors
        });
    } catch (error) {
        console.error('Bulk invite error:', error);
        return res.status(400).json({ error: error.message || 'Internal server error' });
    }
});

// ==========================================
// ENDPOINT: ACCEPT INVITE
// ==========================================
app.post('/api/accept-invite', provisionLimiter, async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // 1. Find user by token
        const { data: userRow, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('id, invite_expires_at, status')
            .eq('invite_token', token)
            .single();

        if (fetchError || !userRow) {
            return res.status(404).json({ error: 'Invalid or expired invitation token' });
        }

        if (userRow.status !== 'invited') {
            return res.status(400).json({ error: 'This invitation has already been processed' });
        }

        if (new Date(userRow.invite_expires_at) < new Date()) {
            return res.status(400).json({ error: 'This invitation has expired' });
        }

        // 2. Update Auth User Password
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
            userRow.id,
            { password: password }
        );

        if (updateAuthError) {
            throw updateAuthError;
        }

        // 3. Update public.users status and clear token
        const { error: updateDbError } = await supabaseAdmin
            .from('users')
            .update({
                status: 'active',
                invite_token: null,
                invite_expires_at: null
            })
            .eq('id', userRow.id);

        if (updateDbError) {
            throw updateDbError;
        }

        return res.status(200).json({ success: true, message: 'Password set successfully' });

    } catch (error) {
        console.error('Accept invite error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Keep legacy endpoint running but redirecting logic or returning deprecated
app.post('/api/provision-employee', (req, res) => {
    res.status(400).json({ error: 'Deprecated. Use /api/invite instead.' });
});

const PORT = process.env.PORT || 5001;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Universal Invite Engine API running on port ${PORT}`);
    });
} else {
    module.exports = app;
}
