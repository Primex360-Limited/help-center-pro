import admin from "firebase-admin";
import { env } from "./env.js";

let initialized = false;

function normalizePrivateKey(value) {
    if (!value) return null;
    return String(value).replace(/\\n/g, "\n").trim();
}

function looksLikePlaceholder(value) {
    const raw = String(value || "").trim();
    if (!raw) return true;
    return /YOUR_|CHANGE_ME|REPLACE_ME|xxxxx/i.test(raw);
}

export function isFirebaseAdminConfigured() {
    return Boolean(
        env.FIREBASE_PROJECT_ID &&
            env.FIREBASE_CLIENT_EMAIL &&
            env.FIREBASE_PRIVATE_KEY &&
            !looksLikePlaceholder(env.FIREBASE_PROJECT_ID) &&
            !looksLikePlaceholder(env.FIREBASE_CLIENT_EMAIL) &&
            !looksLikePlaceholder(env.FIREBASE_PRIVATE_KEY)
    );
}

export function getFirebaseAdmin() {
    if (!isFirebaseAdminConfigured()) {
        const error = new Error(
            "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
        );
        error.statusCode = 503;
        throw error;
    }

    if (!initialized) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: env.FIREBASE_PROJECT_ID,
                clientEmail: env.FIREBASE_CLIENT_EMAIL,
                privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY)
            })
        });
        initialized = true;
    }

    return admin;
}

export async function verifyFirebaseIdToken(idToken) {
    const firebaseAdmin = getFirebaseAdmin();
    const decoded = await firebaseAdmin.auth().verifyIdToken(String(idToken || ""), true);

    if (!decoded?.email) {
        const error = new Error("Google account email is required");
        error.statusCode = 400;
        throw error;
    }

    return {
        uid: decoded.uid,
        email: String(decoded.email).toLowerCase().trim(),
        emailVerified: Boolean(decoded.email_verified),
        name: decoded.name || "",
        picture: decoded.picture || null
    };
}
