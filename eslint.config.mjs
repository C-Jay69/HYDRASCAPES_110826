import nextConfig from 'eslint-config-next';

export default [
  ...(Array.isArray(nextConfig) ? nextConfig : [nextConfig]),
  {
    ignores: ['node_modules/**', '.next/**', 'build/**', 'dist/**', 'legacy/**'],
  },
];