"use client";

// TEMP local visual-QA harness for the editable-profile "Your details" block
// and its picker overlays (no auth). Mirrors the real profile page structure
// (.lh > .pf-top pinned + .pf-content scroll) so overlay framing + scroll-lock
// reproduce faithfully. Delete with the other /dev-preview routes.
import { EditableDetails } from "@/components/profile/EditableDetails";

export default function ProfileEditPreview() {
  return (
    <div className="lh">
      <div className="pf-top">
        <header className="pf-head">
          <div className="pf-av" style={{ background: "linear-gradient(135deg,#5b8fe0,#a5e8ff)" }} />
          <div className="pf-id">
            <h1 className="pf-name">Awesome</h1>
            <p className="pf-role">Entry · HR</p>
          </div>
        </header>
        <div className="pf-xp">
          <div className="pf-xp-row">
            <span>Level 3</span>
            <span>432 XP</span>
          </div>
          <div className="pf-bar">
            <i style={{ width: "44%" }} />
          </div>
        </div>
        <div className="pf-stats">
          <div className="pf-stat"><b>🔥 1</b><span>Streak</span></div>
          <div className="pf-stat"><b>5</b><span>Lessons</span></div>
          <div className="pf-stat"><b>3</b><span>Sims</span></div>
          <div className="pf-stat"><b>5</b><span>Badges</span></div>
        </div>
      </div>
      <main className="pf-content">
        <section className="pf-sec">
          <h2 className="pf-sec-h">Your details</h2>
          <EditableDetails
            initial={{
              name: "SG",
              email: "sg61300@gmail.com",
              mobile: null,
              seniority: "entry",
              profession: "hr",
              ai_proficiency: "l1",
            }}
          />
        </section>
        <p className="pf-foot">AI &amp; Tech for Professionals · Level 1</p>
      </main>
    </div>
  );
}
