export function getPasswordRequirements(password = "") {
  return [
    {
      id: "length",
      label: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      id: "uppercase",
      label: "Uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lowercase",
      label: "Lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      id: "number",
      label: "Number",
      met: /\d/.test(password),
    },
    {
      id: "special",
      label: "Special character e.g #,$,% etc",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export function isPasswordValid(password = "") {
  return getPasswordRequirements(password).every((item) => item.met);
}
