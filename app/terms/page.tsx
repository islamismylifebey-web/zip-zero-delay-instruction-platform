import Link from "next/link";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCompanyContact, phoneHref } from "@/lib/company-contact";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const contact = await getCompanyContact(await getChatGPTUser());

  return (
    <main className="legal-page">
      <header>
        <Link href="/" className="legal-brand">Speak. Assign. Done.</Link>
        <span>{contact?.companyName ?? "Company workforce operations"}</span>
      </header>
      <article>
        <Link href="/" className="legal-back">← Back to app</Link>
        <span className="eyebrow">Effective July 18, 2026</span>
        <h1>Terms of Use</h1>
        <p>These terms govern your use of Speak. Assign. Done., a workforce coordination service activated for an individual company.</p>

        <h2>Authorized use</h2>
        <p>Use the service only for lawful workforce operations. Company owners and dispatchers must have authority to enter employee contact information, job addresses, instructions, and business mileage. Users must keep their sign-in account secure.</p>

        <h2>Company responsibility</h2>
        <p>The company is responsible for reviewing every structured assignment before sending it, appointing roles carefully, and keeping its owner contact information current. Voice and text parsing may require correction. Do not rely on the service for emergency response, safety certification, payroll, tax calculation, or legal compliance.</p>

        <h2>Worker responsibility</h2>
        <p>Workers must update job status honestly, protect customer information, obey workplace safety rules, and use navigation links responsibly.</p>

        <h2>Third-party services</h2>
        <p>Sign-in, hosting, speech recognition, and mapping may be supplied by third parties under their own terms and privacy practices.</p>

        <h2>Availability</h2>
        <p>We work to keep the service accurate and available, but internet, browser, device, or third-party interruptions may occur. Keep an alternate method for urgent workforce communication.</p>

        <h2>Account suspension</h2>
        <p>Access may be limited for misuse, unauthorized access, unlawful activity, security threats, or violations of these terms.</p>

        <h2>Disclaimer and liability</h2>
        <p>The service is provided as available. To the maximum extent permitted by law, the service provider is not responsible for indirect damages, lost profits, unsafe work decisions, inaccurate user entries, or failures of third-party services.</p>

        <h2>Company contact</h2>
        {contact ? (
          <p>Questions about this activated workspace may be directed to <strong>{contact.name}</strong>{contact.email ? <> at <a href={`mailto:${contact.email}`}>{contact.email}</a></> : null}{contact.phone ? <> or <a href={phoneHref(contact.phone)}>{contact.phone}</a></> : null}.</p>
        ) : (
          <p>Open this page while signed in to your activated company workspace to see the owner’s current contact details.</p>
        )}
      </article>
      <footer>
        <Link href="/">Return to app</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/account">Account &amp; Data</Link>
      </footer>
    </main>
  );
}
