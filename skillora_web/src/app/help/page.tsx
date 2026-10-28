import Link from "next/link";

import { AskAiButton } from "@/components/ask-ai-button";
import { MarketplaceLayout } from "@/components/marketplace-layout";
import { Button } from "@/components/ui/button";

export default function HelpPage() {
  return (
    <MarketplaceLayout>
      <section className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <div className="space-y-6">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-medium text-primary">Support</p>
            <h1 className="text-3xl font-bold tracking-tight">How can we help?</h1>
            <p className="text-muted-foreground">
              Start with the common paths below. Signed-in users can also use Skillora chat for course and account help.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="panel-ring rounded-[var(--radius-card)] bg-card/90 p-5">
              <h2 className="font-semibold">Learners</h2>
              <p className="mt-2 text-sm text-muted-foreground">Find courses, retry payments, resume lessons, and submit practice work.</p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/dashboard">Open learning</Link>
              </Button>
            </div>
            <div className="panel-ring rounded-[var(--radius-card)] bg-card/90 p-5">
              <h2 className="font-semibold">Instructors</h2>
              <p className="mt-2 text-sm text-muted-foreground">Build curriculum, submit courses for review, and grade assignments.</p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/instructor">Open studio</Link>
              </Button>
            </div>
            <div className="panel-ring rounded-[var(--radius-card)] bg-card/90 p-5">
              <h2 className="font-semibold">Platform help</h2>
              <p className="mt-2 text-sm text-muted-foreground">Ask Skillora AI about course access, payment status, lesson help, or account steps.</p>
              <AskAiButton
                className="mt-4 w-full"
                label="Open Skillora AI"
                prompt="Help me find the fastest way to solve my Skillora account, payment, or course access question."
              />
            </div>
          </div>
        </div>
      </section>
    </MarketplaceLayout>
  );
}
