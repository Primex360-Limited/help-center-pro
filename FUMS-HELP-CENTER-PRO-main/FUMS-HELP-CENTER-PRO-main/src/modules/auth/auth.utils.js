import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"
import crypto from "crypto"
import { env } from "../../config/env.js";

export async function hashPassword(plainPassword) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plainPassword, salt)
}

export async function comparePassword(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash)
}

export function generateAccessToken(payload) {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN
    })
}

export function verifyAccessToken(token) {
    return jwt.verify(token, env.JWT_ACCESS_SECRET)
}

export function generateRefreshToken(payload) {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });
}

export function verifyRefreshToken(token) {
    return jwt.verify(token, env.JWT_REFRESH_SECRET)
}

export function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex")
}

export function generateRandomToken() {
    return crypto.randomBytes(32).toString("hex")
}

export function generateTemporaryPassword(length = 12) {
    return crypto
        .randomBytes(length)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, length)
}