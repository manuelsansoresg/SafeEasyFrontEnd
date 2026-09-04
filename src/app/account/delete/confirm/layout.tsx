export default function AccountDeletionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f2f3f4] px-4 pt-32 pb-12 sm:px-6">
      <div className="mx-auto max-w-[860px]">{children}</div>
    </div>
  );
}
