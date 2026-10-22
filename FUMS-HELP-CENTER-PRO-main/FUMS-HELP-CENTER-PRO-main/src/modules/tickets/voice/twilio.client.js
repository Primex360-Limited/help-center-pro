import twilio from "twilio";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";

let client = null;

/** REST calling needs account credentials; caller ID is resolved per tenant. */
export function isTwilioConfigured() {
    return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
}

/** Browser softphone (Voice JS SDK) additionally needs API keys + a TwiML App. */
export function isBrowserVoiceConfigured() {
    return Boolean(
        env.TWILIO_ACCOUNT_SID &&
            env.TWILIO_API_KEY_SID &&
            env.TWILIO_API_KEY_SECRET &&
            env.TWILIO_TWIML_APP_SID
    );
}

export function getTwilioClient() {
    if (!isTwilioConfigured()) {
        throw new AppError(
            "Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN (and provision a HelpCentre Pro call number).",
            503
        );
    }

    if (!client) {
        client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }

    return client;
}

export function getTwilioPhoneNumber() {
    return env.TWILIO_PHONE_NUMBER || null;
}

/**
 * Browser softphone capability token (Voice JS SDK).
 * Requires TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET + TWILIO_TWIML_APP_SID.
 */
export function createVoiceAccessToken({ identity }) {
    if (!isBrowserVoiceConfigured()) {
        throw new AppError(
            "Browser voice is not configured. Set TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, and TWILIO_TWIML_APP_SID, or add an agent phone number to use handset calling.",
            503
        );
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;
    const token = new AccessToken(
        env.TWILIO_ACCOUNT_SID,
        env.TWILIO_API_KEY_SID,
        env.TWILIO_API_KEY_SECRET,
        { identity: identity || "agent", ttl: 3600 }
    );

    token.addGrant(
        new VoiceGrant({
            outgoingApplicationSid: env.TWILIO_TWIML_APP_SID,
            incomingAllow: true
        })
    );

    return token.toJwt();
}

export default {
    isTwilioConfigured,
    isBrowserVoiceConfigured,
    getTwilioClient,
    getTwilioPhoneNumber,
    createVoiceAccessToken
};
