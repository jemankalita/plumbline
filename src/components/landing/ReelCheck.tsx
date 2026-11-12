import Link from "next/link";
import { Reveal } from "./Landing";
import { WordsReveal } from "./Motion";

const VIDEO = "/demo/reel-check.mp4";
const POSTER = "/demo/reel-check-poster.jpg";
const SAMPLE_REEL = "/demo/quickkart-winter-sale-reel.mp4";

const STEPS = [
  { title: "Pick the brand", body: "Each organisation has its own Brand Kit: rules, approved names, facts and logo. A Reel is checked only against its own kit." },
  { title: "Add the Reel", body: "Frames are taken in your browser. The video file stays on your device." },
  { title: "AI reads, code checks", body: "AI only reads the words on screen and finds the logo. Plain code applies the kit. Speech isn't checked." },
  { title: "A person decides", body: "Every problem shows its time in the video and the rule it breaks. Blockers stop approval until they're dealt with." },
];

/** A recording of the real app checking one Reel against one Brand Kit. */
export function ReelCheck() {
  return (
    <section id="reel" className="scroll-mt-4 bg-white px-[var(--margin)] py-[clamp(72px,8vw,128px)] text-soot">
      <Reveal>
        <WordsReveal className="display text-[36px] lg:text-[clamp(40px,4.4vw,64px)]" text="Check a Reel before it goes out" />
        <p className="mt-4 max-w-[60ch] text-[17px] leading-[1.55] text-muted lg:text-[18px]">
          This is the real app checking one Reel against one company&apos;s Brand Kit, recorded in one take. QuickKart is a made-up brand and the mistakes are planted. The video plays at 1.25× speed. The check itself took 13 seconds.
        </p>
      </Reveal>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[3fr_2fr] lg:gap-12">
        <Reveal i={1}>
          <video
            controls
            playsInline
            preload="none"
            poster={POSTER}
            width={1280}
            height={720}
            aria-label="Screen recording with captions: a Winter Sale Reel is added, checked against the QuickKart Brand Kit, and five problems are listed with their times."
            className="aspect-video h-auto w-full bg-soot"
          >
            <source src={VIDEO} type="video/mp4" />
            <a href={VIDEO}>Download the recording</a>
          </video>
        </Reveal>

        <Reveal i={2}>
          <ol className="grid gap-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[2rem_1fr]">
                <span className="text-[17px] font-medium tabular-nums text-muted">{index + 1}</span>
                <div>
                  <h3 className="text-[18px] font-medium">{step.title}</h3>
                  <p className="mt-1 text-[16px] leading-[1.5] text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[16px] font-medium">
            <Link href="/new" className="underline underline-offset-4">Try it on your own Reel</Link>
            <a href={SAMPLE_REEL} download className="underline underline-offset-4">Download the sample Reel</a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
