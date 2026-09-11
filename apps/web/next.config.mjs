/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@limen-vault/ui', '@limen-vault/vault-schema'],
};

export default nextConfig;
