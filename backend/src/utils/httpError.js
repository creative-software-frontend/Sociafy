/**
 * Consistent, security-safe HTTP error responses.
 *
 * - 4xx (intentional client errors, e.g. "Insufficient wallet balance") keep
 *   their user-facing message.
 * - 5xx (server/database failures) always return a generic message to the
 *   client and log the real error server-side.
 */

const GENERIC_500 = "An internal server error occurred.";

function handleError(res, err, fallback = GENERIC_500) {
    const status = err && err.statusCode ? Number(err.statusCode) : 500;
    if (status >= 500) {
        console.error("[api error]", status, err && err.message);
        return res.status(500).json({ message: GENERIC_500 });
    }
    return res.status(status).json({ message: (err && err.message) || fallback });
}

function boom(status, message) {
    const err = new Error(message);
    err.statusCode = status;
    return err;
}

module.exports = { handleError, boom, GENERIC_500 };
