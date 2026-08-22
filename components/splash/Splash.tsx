import Link from "next/link";
import "./splash.css";

/**
 * Splash / first-open screen (PRD/13 Screen 0, Design/activation-spine.html §1).
 * Rune stands blended into the scene on a glowing pedestal; one coral CTA, with
 * sign-in demoted to a link. Both routes go to /login (Google + email OTP there).
 */
export function Splash() {
  return (
    <main className="splash-screen">
      <div className="splash-aura" />

      <div className="brandlock">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot/rune-canonical.png" alt="" />
        <b>AI &amp; Tech for Pros</b>
      </div>

      <div className="splash-stage">
        <div className="mascot-scene">
          <div className="glowring" />
          <div className="pedestal" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mascot-cut" src="/mascot/rune-hero-clean.png" alt="Rune, your AI guide" />
          <div className="forbit f1">📚</div>
          <div className="forbit f2">✨</div>
          <div className="forbit f3">🔥</div>
          <div className="forbit f4">🏆</div>
          <span className="spark s1" />
          <span className="spark s2" />
          <span className="spark s3" />
        </div>
      </div>

      <div className="sheet">
        <h1>
          Actually <em>do your job</em> with AI.
        </h1>
        <p className="sub">Five-minute lessons and real HR simulations, guided by Rune.</p>
        <div className="valstrip">
          <span>📚 Bite-size</span>
          <span>✨ Real tasks</span>
          <span>🔥 Streaks</span>
        </div>
        <div className="splash-cta">
          <Link href="/login" className="cta-primary">
            Get started, it&apos;s free
          </Link>
          <div className="signlink">
            Already have an account?{" "}
            <Link href="/login">
              <b>Sign in</b>
            </Link>
          </div>
        </div>
        <p className="legal">Dummy data only, your real HR files never touch the AI.</p>
      </div>
    </main>
  );
}
