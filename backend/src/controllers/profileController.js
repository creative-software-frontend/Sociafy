const db = require("../config/db");

function isISODate(value) {
    if (typeof value !== 'string') return false;
    // YYYY-MM-DD
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toNullableString(v) {
    if (v === undefined || v === null) return null;
    const s = typeof v === 'string' ? v.trim() : String(v).trim();
    if (!s) return null;
    return s;
}

// GET /api/user/profile
exports.getProfile = (req, res) => {
    const userId = req.user.id;

    db.query(
        `SELECT 
            id,
            name,
            email,
            phone,
            gender,
            date_of_birth,
            profession,
            education,
            location,
            bio,
            interests,
            relationship_goal,
            marital_status,
            avatar_url,
            role,
            created_at
        FROM users
        WHERE id = ?`,
        [userId],
        (err, result) => {
            if (err) return res.status(500).json({ message: "An internal server error occurred." });
            if (!result || result.length === 0) return res.status(404).json({ message: "User not found" });
            return res.json(result[0]);
        }
    );
};

// PUT /api/user/profile
exports.updateProfile = (req, res) => {
    const userId = req.user.id;

    const {
        // editable
        name,
        phone,
        gender,
        date_of_birth,
        profession,
        education,
        location,
        bio,
        interests,
        relationship_goal,
        marital_status,
        avatar_url,

        // immutable / forbidden
        role,
        email,
    } = req.body || {};

    if (role !== undefined) {
        return res.status(400).json({ message: "Role changes are not allowed" });
    }
    if (email !== undefined) {
        return res.status(400).json({ message: "Email changes are not allowed" });
    }

    // Basic validation (only validate fields if provided)
    if (name !== undefined && (!name || typeof name !== 'string' || name.trim().length < 2)) {
        return res.status(400).json({ message: "Invalid name" });
    }

    if (phone !== undefined && (!phone || typeof phone !== 'string' || phone.trim().length < 6)) {
        return res.status(400).json({ message: "Invalid phone" });
    }

    if (date_of_birth !== undefined && date_of_birth !== null && date_of_birth !== "") {
        if (!isISODate(date_of_birth)) {
            return res.status(400).json({ message: "date_of_birth must be YYYY-MM-DD" });
        }
    }

    const allowedGenders = [
        "male",
        "female",
        "other",
        "prefer_not_to_say",
        "",
        null,
        undefined,
    ];

    if (gender !== undefined && !allowedGenders.includes(gender)) {
        return res.status(400).json({ message: "Invalid gender" });
    }

    // interests: accept string (comma separated) or null
    const interestsNormalized = interests === undefined ? undefined : toNullableString(interests);

    const updates = {
        name: name !== undefined ? toNullableString(name) : undefined,
        phone: phone !== undefined ? toNullableString(phone) : undefined,
        gender: gender !== undefined ? toNullableString(gender) : undefined,
        date_of_birth: date_of_birth === undefined ? undefined : (date_of_birth ? date_of_birth : null),
        profession: profession !== undefined ? toNullableString(profession) : undefined,
        education: education !== undefined ? toNullableString(education) : undefined,
        location: location !== undefined ? toNullableString(location) : undefined,
        bio: bio !== undefined ? toNullableString(bio) : undefined,
        interests: interestsNormalized,
        relationship_goal: relationship_goal !== undefined ? toNullableString(relationship_goal) : undefined,
        marital_status: marital_status !== undefined ? toNullableString(marital_status) : undefined,
        avatar_url: avatar_url !== undefined ? toNullableString(avatar_url) : undefined,
    };

    const setClauses = [];
    const values = [];

    for (const [key, val] of Object.entries(updates)) {
        if (val === undefined) continue;
        setClauses.push(`${key} = ?`);
        values.push(val);
    }

    if (setClauses.length === 0) {
        return res.status(400).json({ message: "No editable fields provided" });
    }

    values.push(userId);

    db.query(
        `UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`,
        values,
        (err) => {
            if (err) return res.status(500).json({ message: "An internal server error occurred." });
            // return updated
            db.query(
                `SELECT 
                    id,
                    name,
                    email,
                    phone,
                    gender,
                    date_of_birth,
                    profession,
                    education,
                    location,
                    bio,
                    interests,
                    relationship_goal,
                    marital_status,
                    avatar_url,
                    role,
                    created_at
                 FROM users WHERE id = ?`,
                [userId],
                (err2, result2) => {
                    if (err2) return res.status(500).json({ message: "An internal server error occurred." });
                    return res.json(result2[0]);
                }
            );
        }
    );
};

