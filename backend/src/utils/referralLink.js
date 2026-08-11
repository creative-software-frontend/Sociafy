/**
 * Generate a referral link with a strict format:
 * - User: starts with "S" => S<userId><6-char-suffix>
 * - Provider: starts with "P" => P<userId><6-char-suffix>
 *
 * This guarantees ref= always begins with S or P.
 */
function generateReferralLink(userId, role) {
    const numericUserId = Number(userId);
    if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
        throw new Error("Invalid userId for referral link");
    }

    const prefix = role === "provider" ? "P" : "S";

    // 6 chars, uppercase base36 (A-Z,0-9)
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();

    const referralCode = `${prefix}${numericUserId}${suffix}`;

    return {
        code: referralCode,
        url: `https://sociafy-eta.vercel.app/login.php?ref=${referralCode}`
    };
}

/**
 * Decode referral code to extract role and user ID
 */
function decodeReferralCode(code) {
    const prefix = code.charAt(0);
    const role = prefix === 'P' ? 'provider' : prefix === 'S' ? 'user' : null;
    
    if (!role) {
        throw new Error('Invalid referral code');
    }
    
    // Extract user ID (everything after prefix, before random part)
    // Random part is last 6 chars, so user ID is in the middle
    const userIdStr = code.substring(1, code.length - 6);
    const userId = parseInt(userIdStr, 10);
    
    return { 
        role, 
        userId, 
        code 
    };
}

module.exports = { generateReferralLink, decodeReferralCode };