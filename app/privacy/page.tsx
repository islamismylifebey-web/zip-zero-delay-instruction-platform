import Link from "next/link";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCompanyContact, phoneHref } from "@/lib/company-contact";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const contact = await getCompanyContact(await getChatGPTUser());

  return (
    <main className="legal-page">
      <header>
        <Link href="/" className="legal-brand">Speak. Assign. Done.</Link>
        <span>{contact?.companyName ?? "Private company workspaces"}</span>
      </header>
      <article>
        <Link href="/" className="legal-back">← Back to app</Link>
        <span className="eyebrow">Effective July 18, 2026</span>
        <h1>Privacy Policy</h1>
        <p>Speak. Assign. Done. stores only the information needed to coordinate field work and protect each company workspace.</p>

        <h2>Information we collect</h2>
        <ul>
          <li>Your secure sign-in email and available display name.</li>
          <li>Crew names, work email addresses, phone numbers, roles, and work status entered by an authorized company user.</li>
          <li>Assignments, job locations, requirements, status history, job messages, and business mileage.</li>
          <li>Basic technical information needed to secure and operate the service.</li>
        </ul>

        <h2>Company separation</h2>
        <p>Every company has an isolated workspace. Employees, managers, editors, and administrators can access only the company that invited them and only the information allowed by their assigned role.</p>

        <h2>Voice input</h2>
        <p>Voice capture uses speech recognition available through your browser or device. Speak. Assign. Done. receives the resulting text. It does not intentionally store the original audio recording. Voice calibration entries remain in that browser.</p>

        <h2>How information is used</h2>
        <p>Information is used to authenticate users, deliver assigned work, update job status, support dispatcher-worker communication, calculate mileage, prevent misuse, and maintain the service.</p>

        <h2>Sharing and selling</h2>
        <p>We do not sell personal information. Information may be processed by service providers that host or secure the application, or disclosed when legally required.</p>

        <h2>Retention and deletion</h2>
        <p>Workspace information is kept while the workspace remains active or while it is reasonably needed for business, security, or legal purposes. Signed-in users can open <Link href="/account">Account &amp; Data</Link> to delete their application account data. An owner deletion removes the complete workspace. An employee deletion disconnects that login and removes direct contact information while preserving anonymized business job records.</p>

        <h2>Your company contact</h2>
        {contact ? (
          <p>Request access, correction, or deletion from <strong>{contact.name}</strong>{contact.email ? <> at <a href={`mailto:${contact.email}`}>{contact.email}</a></> : null}{contact.phone ? <> or <a href={phoneHref(contact.phone)}>{contact.phone}</a></> : null}. These contact details are managed by {contact.companyName}.</p>
        ) : (
          <p>Open this page while signed in to your activated company workspace to see the owner’s current privacy contact details.</p>
        )}

        <h2>Children</h2>
        <p>This business workforce service is not directed to children under 13.</p>

        <h2>Changes</h2>
        <p>Material changes will be posted here with a revised effective date.</p>
      </article>
      <footer>
        <Link href="/">Return to app</Link>
        <Link href="/terms">Terms of Use</Link>
        <Link href="/account">Account &amp; Data</Link>
      </footer>
    </main>
  );
}
