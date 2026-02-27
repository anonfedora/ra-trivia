import { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Admin Setup - Quiz Portal",
    description: "Create administrator account for Quiz Portal",
    robots: "noindex, nofollow",
};

export default function SetupAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
