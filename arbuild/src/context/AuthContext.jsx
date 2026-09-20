import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider, ALLOWED_DOMAIN } from "../firebase/config";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      if (firebaseUser) {
        const email = firebaseUser.email || "";
        if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          setAuthError(
            `Please sign in with your @${ALLOWED_DOMAIN} school account.`
          );
          await firebaseSignOut(auth);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setUser(firebaseUser);

        const profileRef = doc(db, "students", firebaseUser.uid);
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          setProfile(null); // triggers profile completion flow
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signInWithGoogle() {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setAuthError("Sign-in failed. Please try again.");
      }
    }
  }

  async function completeProfile({ firstName, middleName, lastName, section }) {
    if (!user) return;
    const profileData = {
      firstName,
      middleName: middleName || "",
      lastName,
      section,
      email: user.email,
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "students", user.uid), profileData);
    setProfile(profileData);
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  }

  const value = {
    user,
    profile,
    loading,
    authError,
    signInWithGoogle,
    completeProfile,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
