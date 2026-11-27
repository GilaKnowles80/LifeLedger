import PaymentStatus from "./payment-status";

type CompletionPageProps = {
  searchParams: Promise<{ token?: string; proof?: string; adPayment?: string }>;
};

export default async function CompletionPage({ searchParams }: CompletionPageProps) {
  const params = await searchParams;
  return (
    <PaymentStatus
      orderId={params.token || ""}
      proof={params.proof || ""}
      cancelled={params.adPayment === "cancelled"}
    />
  );
}