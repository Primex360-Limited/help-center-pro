const PASSWORD_RULES = [
    {
        id: "uppercase",
        label: "Uppercase letter",
        test: (value) => /[A-Z]/.test(value)
    },
    {
        id: "lowercase",
        label: "Lowercase letter",
        test: (value) => /[a-z]/.test(value)
    },
    {
        id: "number",
        label: "Number",
        test: (value) => /\d/.test(value)
    },
    {
        id: "special",
        label: "Special character e.g #,$,% etc",
        test: (value) => /[^A-Za-z0-9]/.test(value)
    }
];

export function getPasswordRequirementStatus(password = "") {
    return PASSWORD_RULES.map((rule) => ({
        id: rule.id,
        label: rule.label,
        met: rule.test(password)
    }));
}

export function isStrongPassword(password = "") {
    return (
        password.length >= 8 &&
        PASSWORD_RULES.every((rule) => rule.test(password))
    );
}

export const strongPasswordSchemaMessage =
    "Password must be at least 8 characters and include uppercase, lowercase, number, and special character";
