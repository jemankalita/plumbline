import { Landing } from "@/components/Landing";

export const dynamic = "force-dynamic"; // reads the AI setting at request time

export default function Home() {
  return <Landing aiOn={!!process.env.GEMINI_API_KEY?.trim()} />;
}
