"use client";

import { useState } from "react";

export default function AccountActions() {
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "deleting" | "error">("idle");

  async function deleteData() {
    setState("deleting");
    const response = await fetch("/api/workspace", { method: "DELETE" });
    if (!response.ok) {
      setState("error");
      return;
    }
    window.location.assign("/signout-with-chatgpt?return_to=/");
  }

  return <section className="delete-card"><label>Type DELETE to confirm<input value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" /></label><button className="button danger-light" disabled={confirm !== "DELETE" || state === "deleting"} onClick={deleteData}>{state === "deleting" ? "Deleting…" : "Permanently delete my data"}</button>{state === "error" && <p role="alert">Deletion could not be completed. Please try again or contact support.</p>}</section>;
}
