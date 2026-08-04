import { redirect } from "next/navigation";

/** The builder is the only page in this repo. */
export default function Home() {
  redirect("/automation");
}
