import { requireChatGPTUser } from "./chatgpt-auth";
import WorkforceApp from "./workforce-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");

  return <WorkforceApp ownerName={user.displayName} />;
}
