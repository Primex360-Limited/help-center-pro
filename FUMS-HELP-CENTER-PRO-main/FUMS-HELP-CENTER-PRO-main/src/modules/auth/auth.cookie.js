import { env } from "../../config/env.js";

const accessTokenMaxAge = 15 * 60 * 1000;
const refreshTokenMaxAge = 7 * 24 * 60 * 60 * 1000;

function getCookieBaseOptions() {
    return {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
    };
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
    const baseOptions = getCookieBaseOptions();

    res.cookie("accessToken", accessToken, {
        ...baseOptions,
        maxAge: accessTokenMaxAge
    });

    res.cookie("refreshToken", refreshToken, {
        ...baseOptions,
        maxAge: refreshTokenMaxAge
    });
}

export function clearAuthCookies(res) {
    const baseOptions = getCookieBaseOptions();

    res.clearCookie("accessToken", {
        ...baseOptions
    });

    res.clearCookie("refreshToken", {
        ...baseOptions
    });
}
