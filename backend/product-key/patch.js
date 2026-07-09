// 2b. Atomic Workspace Onboarding
exports.onboardWorkspace = async (req, res) => {
    const { productKey, workspaceId, workspaceName, executionMode, defaultLanes, workflowRules, settings, user } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const geo = geoip.lookup(ip);
    const userAgent = req.headers['user-agent'];
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    if (!workspaceId || !workspaceName || !user?.id) {
        return res.status(400).json({ error: 'Missing required workspace or user details' });
    }

    // 1. Decode JWT Token (Middleware already verified existence)
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.decode(token);
        if (!decoded || decoded.sub !== user.id) {
            return res.status(401).json({ error: 'Token mismatch' });
        }
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    try {
        // 2. Atomic Mongo License Activation
        let activatedLicense = null;
        if (productKey && productKey !== 'OFFLINE-LICENSE') {
            const initialCheck = await License.findOne({ key: productKey });
            if (!initialCheck) {
                return res.status(404).json({ error: 'Invalid product key' });
            }
            if (initialCheck.status === 'REVOKED') {
                return res.status(403).json({ error: 'Key has been revoked' });
            }

            activatedLicense = await License.findOneAndUpdate(
                { key: productKey, isUsed: false, status: 'AVAILABLE' },
                {
                    $set: {
                        isUsed: true,
                        status: 'ACTIVE',
                        activatedAt: new Date(),
                        usedAt: new Date(),
                        usedBy: user.id,
                        workspaceId,
                        activation: { ip, country: geo?.country, region: geo?.region, city: geo?.city, timezone: geo?.timezone, userAgent, source: 'web' },
                        last_verified_at: new Date()
                    }
                },
                { new: true }
            );

            if (!activatedLicense) {
                const existingUsed = await License.findOne({ key: productKey, workspaceId });
                if (existingUsed) {
                    activatedLicense = existingUsed;
                } else {
                    return res.status(403).json({ error: 'License assigned to another workspace' });
                }
            }
        }

        // 3. Execute Supabase Atomic Onboarding RPC
        if (supabaseAdmin) {
            const rpcPayload = {
                p_workspace_id: workspaceId,
                p_workspace_name: workspaceName,
                p_user_id: user.id,
                p_user_email: user.email || '',
                p_user_full_name: user.full_name || user.name || '',
                p_execution_mode: executionMode || 'KANBAN',
                p_settings: settings || {},
                p_default_lanes: defaultLanes || 5,
                p_workflow_rules: workflowRules || {}
            };

            const { error: rpcError } = await supabaseAdmin.rpc('onboard_workspace_transaction', rpcPayload);

            if (rpcError) {
                console.error('[FATAL] Supabase RPC failed:', rpcError);
                throw new Error('Database transaction failed: ' + rpcError.message);
            }

            // 4. Sync License to Supabase
            if (activatedLicense) {
                await syncSupabaseLicense(productKey, workspaceId, activatedLicense.plan);
            }
        } else {
            console.warn('[WARNING] Supabase Admin not configured. Skipping database setup.');
        }

        const responseToken = activatedLicense ? jwt.sign({ key: activatedLicense.key, workspaceId }, JWT_SECRET, { expiresIn: '30d' }) : null;
        res.json({ success: true, token: responseToken, plan: activatedLicense?.plan || 'STANDARD' });

    } catch (error) {
        console.error('Onboarding transaction error:', error);
        
        // Rollback Mongo Activation if Supabase failed
        if (productKey && productKey !== 'OFFLINE-LICENSE') {
            await License.findOneAndUpdate(
                { key: productKey, workspaceId },
                {
                    $set: {
                        isUsed: false,
                        status: 'AVAILABLE',
                        activatedAt: null,
                        usedAt: null,
                        usedBy: null,
                        workspaceId: null,
                        activation: null,
                        last_verified_at: null
                    }
                }
            );
        }
        
        res.status(500).json({ error: error.message || 'Server error during onboarding' });
    }
};
