export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="-mt-24 md:-mt-28">{children}</div>;
}
