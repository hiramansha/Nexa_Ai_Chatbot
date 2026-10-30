
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { Sparkles, Mail, Lock, User, Chrome } from "lucide-react";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("welcome");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setNotice(error.message);
      setSession(data?.session ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    setBusy(true);
    setNotice("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setNotice(error.message);
      setBusy(false);
    }
  }

  async function submitEmail(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin
          }
        });

        if (error) throw error;

        if (!data.session) {
          setNotice("Account created. Please check your email to confirm your account.");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;
      }
    } catch (error) {
      setNotice(error.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading Nexa AI...</div>;
  }

  if (session) {
    return children;
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logo}><Sparkles size={27} /></div>
        <h1>Nexa <span style={styles.gradient}>AI</span></h1>
        <p style={styles.subtitle}>Your ideas. Your AI. Your next step.</p>

        {mode === "welcome" ? (
          <>
            <h2>Welcome to Nexa AI</h2>
            <p style={styles.description}>Sign in to continue to your AI workspace.</p>
            <button style={styles.google} onClick={signInWithGoogle} disabled={busy}>
              <Chrome size={19} /> Continue with Google
            </button>
            <button style={styles.primary} onClick={() => setMode("login")}>
              <Mail size={18} /> Sign in with Email
            </button>
            <p style={styles.footer}>
              New to Nexa AI?{" "}
              <button style={styles.link} onClick={() => setMode("signup")}>
                Create Account
              </button>
            </p>
          </>
        ) : (
          <>
            <h2>{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
            <form onSubmit={submitEmail}>
              {mode === "signup" && (
                <label style={styles.field}>
                  <User size={17} />
                  <input
                    placeholder="Your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </label>
              )}

              <label style={styles.field}>
                <Mail size={17} />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </label>

              <label style={styles.field}>
                <Lock size={17} />
                <input
                  type="password"
                  placeholder="Password (minimum 6 characters)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </label>

              <button style={styles.primary} disabled={busy}>
                {busy ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}
              </button>
            </form>

            <p style={styles.footer}>
              {mode === "signup" ? "Already have an account?" : "New to Nexa AI?"}{" "}
              <button
                style={styles.link}
                onClick={() => {
                  setNotice("");
                  setMode(mode === "signup" ? "login" : "signup");
                }}
              >
                {mode === "signup" ? "Sign In" : "Create Account"}
              </button>
            </p>
            <button style={styles.back} onClick={() => setMode("welcome")}>
              Back
            </button>
          </>
        )}

        {notice && <p style={styles.notice}>{notice}</p>}
      </section>
    </main>
  );
}

export const authStyles = {
  signOut: async () => supabase.auth.signOut()
};

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "radial-gradient(circle at 50% 15%, #35205e, #090d1b 65%)",
    color: "#f7f4ff",
    fontFamily: "Arial, sans-serif"
  },
  card: {
    width: "min(100%, 420px)",
    padding: 34,
    borderRadius: 24,
    border: "1px solid #ffffff25",
    background: "#11172beF",
    boxShadow: "0 25px 80px #0008",
    textAlign: "center"
  },
  loading: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#090d1b",
    color: "white"
  },
  logo: {
    width: 58,
    height: 58,
    margin: "0 auto 15px",
    display: "grid",
    placeItems: "center",
    borderRadius: 18,
    background: "linear-gradient(135deg,#a855f7,#5b4bdb)"
  },
  gradient: {
    background: "linear-gradient(90deg,#c084fc,#818cf8)",
    WebkitBackgroundClip: "text",
    color: "transparent"
  },
  subtitle: { color: "#aeb4d0", marginBottom: 30 },
  description: { color: "#aeb4d0", fontSize: 14, marginBottom: 22 },
  google: {
    width: "100%", padding: 14, display: "flex", justifyContent: "center",
    alignItems: "center", gap: 10, borderRadius: 11, border: "1px solid #ffffff35",
    background: "#202944", color: "white", cursor: "pointer", marginBottom: 12
  },
  primary: {
    width: "100%", padding: 14, marginTop: 12, border: 0, borderRadius: 11,
    background: "linear-gradient(110deg,#9945ff,#6525e8)",
    color: "white", fontWeight: 700, cursor: "pointer"
  },
  field: {
    display: "flex", alignItems: "center", gap: 10, margin: "12px 0",
    padding: "0 12px", border: "1px solid #ffffff30", borderRadius: 10,
    background: "#1b2340", color: "#b9a5ff"
  },
  input: { color: "white" },
  footer: { color: "#aeb4d0", fontSize: 13, marginTop: 22 },
  link: {
    border: 0, background: "transparent", color: "#c49aff",
    cursor: "pointer", fontWeight: 700
  },
  back: {
    marginTop: 10, border: 0, background: "transparent",
    color: "#b9bdd5", cursor: "pointer"
  },
  notice: {
    padding: 12, borderRadius: 9, background: "#352044",
    color: "#f1d7ff", fontSize: 13, lineHeight: 1.5
  }
};
