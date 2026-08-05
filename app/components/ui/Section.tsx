export default function Section({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <section className="py-24">
        <div className="container">{children}</div>
      </section>
    );
  }