import { execSync } from 'child_process';

let commitHash = 'unknown';
try {
    commitHash = execSync('git log -1 --format=%h').toString().trim();
} catch (e) {
    console.warn('Failed to get git commit hash');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_COMMIT_HASH: commitHash,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                pathname: '**',
            },
        ],
    },
};

export default nextConfig;
