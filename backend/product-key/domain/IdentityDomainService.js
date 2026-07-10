class IdentityDomainService {
  verifyIdentity(jwtUser, requestUserId) {
    if (!jwtUser || !jwtUser.id) {
      throw new Error('Unauthenticated');
    }
    // With Identity Contract Repair, requestUserId shouldn't exist in body,
    // we only use jwtUser.id.
    return {
      id: jwtUser.id,
      email: jwtUser.email,
      fullName: jwtUser.user_metadata?.full_name || jwtUser.user_metadata?.name || ''
    };
  }
}

module.exports = { IdentityDomainService };
