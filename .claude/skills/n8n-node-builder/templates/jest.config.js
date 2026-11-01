/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testMatch: ['**/__tests__/**/*.test.ts'],
	// .claude/ may hold the n8n-node-builder skill, whose templates have tests.
	testPathIgnorePatterns: ['/node_modules/', '/.claude/'],
};
