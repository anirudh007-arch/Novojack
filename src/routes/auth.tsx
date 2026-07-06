import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nova AI" },
      { name: "description", content: "Sign in to your Nova AI voice assistant." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/assistant" });
  },
  component: AuthPage,
});

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else window.location.href = "/assistant";
  };

  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/assistant" },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Account ready. Check your email if confirmation is required.");
  };

  const signInGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/assistant",
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google sign-in failed.");
      return;
    }
    if (result.redirected) return;
    window.location.href = "/assistant";
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <Sparkles className="size-6 text-primary" />
          <span className="text-2xl font-semibold tracking-tight">
            Nova<span className="nova-gradient-text">AI</span>
          </span>
        </Link>

        <div className="glass nova-glow rounded-2xl p-6">
          <h1 className="text-center text-2xl font-semibold">Welcome back</h1>
          <p className="mb-6 mt-1 text-center text-sm text-muted-foreground">
            Sign in to talk with Nova
          </p>

          <Button
            onClick={signInGoogle}
            disabled={loading}
            variant="outline"
            className="mb-4 w-full bg-white/5 hover:bg-white/10"
          >
            <svg className="size-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35 11.1H12v3.8h5.35c-.5 2.4-2.5 3.7-5.35 3.7-3.2 0-5.8-2.6-5.8-5.8s2.6-5.8 5.8-5.8c1.4 0 2.7.5 3.7 1.4l2.7-2.7C16.7 4 14.5 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.7-3.7 8.7-8.8 0-.4 0-.7-.1-1.1z"/></svg>
            Continue with Google
          </Button>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-3 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="email-in">Email</Label>
                <Input id="email-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-in">Password</Label>
                <Input id="pw-in" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button onClick={signIn} disabled={loading || !email || !password} className="w-full nova-gradient-bg text-primary-foreground">
                {loading && <Loader2 className="size-4 animate-spin" />} Sign in
              </Button>
            </TabsContent>
            <TabsContent value="signup" className="space-y-3 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="email-up">Email</Label>
                <Input id="email-up" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-up">Password</Label>
                <Input id="pw-up" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button onClick={signUp} disabled={loading || !email || password.length < 6} className="w-full nova-gradient-bg text-primary-foreground">
                {loading && <Loader2 className="size-4 animate-spin" />} Create account
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to let Nova store conversations and reminders for you.
        </p>
      </div>
    </div>
  );
}
