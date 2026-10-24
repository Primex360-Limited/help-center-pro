/**
 * Twilio has been removed from HelpCentre Pro.
 * Voice uses tenant-configured VoIP/SIP (browser JsSIP softphone) only.
 */

export function isTwilioConfigured() {
    return false;
}

export function isBrowserVoiceConfigured() {
    return false;
}

export function normalizeTwilioCredentials() {
    return {};
}

export function hasTwilioRestCreds() {
    return false;
}

export function hasTwilioBrowserCreds() {
    return false;
}

export function createTwilioClient() {
    throw new Error(
        "Twilio is not supported. Configure a VoIP/SIP provider in Settings → VoIP/SIP."
    );
}

export function getTwilioClient() {
    return createTwilioClient();
}

export function getTwilioPhoneNumber() {
    return null;
}

export function createVoiceAccessToken() {
    throw new Error(
        "Twilio is not supported. Configure a VoIP/SIP provider in Settings → VoIP/SIP."
    );
}

export default {
    isTwilioConfigured,
    isBrowserVoiceConfigured,
    normalizeTwilioCredentials,
    hasTwilioRestCreds,
    hasTwilioBrowserCreds,
    createTwilioClient,
    getTwilioClient,
    getTwilioPhoneNumber,
    createVoiceAccessToken
};
