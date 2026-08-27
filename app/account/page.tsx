import Link from "next/link";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getCompanyContact, phoneHref } from "@/lib/company-contact";
import AccountActions from "./account-actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireChatGPTUser("/account");
  const contact = await getCompanyContact(user);

  return (
    <main className="legal-page">
      <header>
        <Link href="/" className="legal-brand">Speak. Assign. Done.</Link>
        <span>{contact?.companyName ?? "Account & Data"}</span>
      </header>
      <article>
        <Link href="/" className="legal-back">← Back to app</Link>
        <span className="eyebrow">Signed in securely</span>
        <h1>Control your information</h1>
        <p>You are signed in as <strong>{user.email}</strong>.</p>

        <h2>Delete application data</h2>
        <p>For a company owner, deletion permanently removes the workspace, team access, jobs, messages, and mileage. For an employee, deletion disconnects that login and removes direct contact information while keeping anonymized business records.</p>
        <AccountActions />

        <h2>Need help first?</h2>
        {contact ? (
          <p>Contact <strong>{contact.name}</strong>{contact.email ? <> at <a href={`mailto:${contact.email}`}>{contact.email}</a></> : null}{contact.phone ? <> or <a href={phoneHref(contact.phone)}>{contact.phone}</a></> : null}. The owner manages these details in Company settings.</p>
        ) : (
          <p>Ask your company owner or administrator to connect your sign-in email to the correct workspace.</p>
        )}
      </article>
      <footer>
        <Link href="/">Return to app</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Use</Link>
      </footer>
    </main>
  );
}
