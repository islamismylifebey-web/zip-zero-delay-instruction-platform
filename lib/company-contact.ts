import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { getWorkspace, parseWorkspace, resolveAccess } from "@/lib/workspace-server";

export type CompanyContact = {
  companyName: string;
  name: string;
  email: string;
  phone: string;
};

export async function getCompanyContact(user: ChatGPTUser | null): Promise<CompanyContact | null> {
  if (!user) return null;
  const access = await resolveAccess(user.email, user.displayName);
  if (access.role === "unassigned") return null;
  const row = await getWorkspace(access.ownerEmail);
  if (!row) return null;
  const company = parseWorkspace(row.data).company;
  return {
    companyName: company.name || "Your company",
    name: company.contactName || (access.role === "owner" ? user.displayName : "Company owner"),
    email: company.contactEmail || access.ownerEmail,
    phone: company.contactPhone,
  };
}

export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
