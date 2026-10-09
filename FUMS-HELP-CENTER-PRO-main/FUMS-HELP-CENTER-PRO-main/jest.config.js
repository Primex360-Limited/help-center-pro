export default {
    testEnvironment: "node",
    roots: ["<rootDir>/tests"],
    collectCoverageFrom: [
        "src/modules/tickets/**/*.js",
        "!src/modules/tickets/**/*.test.js",
    ]
};