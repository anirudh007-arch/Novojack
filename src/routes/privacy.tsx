import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, Section } from "@/components/nova/LegalLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Nova AI" },
      { name: "description", content: "How Nova AI collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

const CONTACT_EMAIL = "anirudhv16742@gmail.com";

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="July 6, 2026">
      <Section title="Overview">
        <p>
          Nova AI ("Nova", "we", "us") is a voice-first personal assistant that helps you capture
          notes, set reminders, manage tasks, and — with your permission — read a summary of your
          unread email and calendar events. This policy explains what information Nova collects,
          how it's used, and the choices you have.
        </p>
      </Section>

      <Section title="Information we collect">
        <ul>
          <li><strong>Account information</strong> — your email address and display name, whether you sign up with a password or with Google.</li>
          <li><strong>Preferences</strong> — assistant voice, language, personality, response length, wake word, city (for weather/briefing), and accent color.</li>
          <li><strong>Content you create</strong> — notes, todos, reminders, "memories" (facts Nova remembers about you), and your conversation history with Nova.</li>
          <li><strong>Uploaded files</strong> — images or PDFs you submit to Vision, sent to Google's Gemini API to be analyzed and not stored by Nova beyond that request.</li>
          <li><strong>Voice input</strong> — speech is transcribed to text directly in your browser; only the resulting text (not raw audio) is sent to generate a reply.</li>
          <li><strong>Google account data</strong> (only if you connect Google) — see the dedicated section below.</li>
        </ul>
      </Section>

      <Section title="Google user data">
        <p>
          If you choose to connect your Google account, Nova requests permission to: read metadata
          for your unread Gmail messages (sender, subject, and a short snippet) so it can summarize
          them to you; create Gmail drafts for your review (Nova never sends email on your behalf);
          and read and create events on your primary Google Calendar.
        </p>
        <p>
          This data is used solely to power the specific feature you asked for (e.g. "read my
          unread emails" or "what's on my calendar"), is never sold, and is never used for
          advertising. <strong>Nova AI's use and transfer to any other app of information received
          from Google APIs will adhere to the
          {" "}<a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>,
          including the Limited Use requirements.</strong>
        </p>
        <p>
          You can disconnect your Google account at any time from Settings → Connections, or by
          revoking Nova's access directly from your{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google Account permissions page</a>.
        </p>
      </Section>

      <Section title="How we use information">
        <p>
          We use your data to operate Nova, personalize its responses to your stated preferences
          and remembered facts, and to carry out the actions you explicitly ask for (creating a
          reminder, drafting an email, adding a calendar event, and similar). We do not sell your
          personal data.
        </p>
      </Section>

      <Section title="Third-party services">
        <ul>
          <li><strong>Supabase</strong> — hosts our database and handles authentication; your account and content data is stored there.</li>
          <li><strong>Google Gemini API</strong> — processes chat, vision, and text-to-speech requests to generate Nova's responses.</li>
          <li><strong>Google OAuth, Gmail API, Calendar API</strong> — used only if you connect your Google account, as described above.</li>
        </ul>
      </Section>

      <Section title="Data storage and security">
        <p>
          Your data is stored in a Postgres database with row-level security enabled, meaning only
          your own authenticated account can read or write your notes, todos, reminders, memories,
          and conversations. Google OAuth tokens are stored separately and are only ever accessed
          by privileged server-side operations — never exposed to the browser or to other users.
        </p>
      </Section>

      <Section title="Data retention and deletion">
        <p>
          You can delete individual notes, todos, reminders, or memories at any time directly in
          the app. To request deletion of your entire account and all associated data, contact us
          at the email below.
        </p>
      </Section>

      <Section title="Children's privacy">
        <p>
          Nova AI is not directed at children and we do not knowingly collect personal information
          from children under 13.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be reflected by
          updating the "Last updated" date above.
        </p>
      </Section>

      <Section title="Contact">
        <p>Questions about this policy or your data? Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </Section>
    </LegalLayout>
  );
}
