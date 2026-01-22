import 'next-auth';

declare module 'next-auth' {
    interface User {
        id: string;
        rollNumber?: string;
        role?: string;
    }

    interface Session {
        user: {
            id: string;
            name: string;
            email: string;
            rollNumber?: string;
            role?: string;
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id?: string;
        rollNumber?: string;
        role?: string;
    }
}
