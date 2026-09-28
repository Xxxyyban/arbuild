import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile 
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage, ALLOWED_DOMAINS, STUDENT_DOMAIN } from "../firebase/config";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const deriveRoleFromEmail = (email) => {
    if (!email) return "student";
    const lowerEmail = email.toLowerCase();
    if (lowerEmail.endsWith(`@${STUDENT_DOMAIN}`)) {
      return "student";
    }
    return "faculty";
  };

  const loginWithEmail = async (emailInput, passwordInput) => {
    setLoading(true);
    setAuthError("");
    try {
      const formattedEmail = emailInput.trim().toLowerCase();
      const domain = formattedEmail.split("@")[1];

      if (!ALLOWED_DOMAINS.includes(domain)) {
        setAuthError(`Access denied. Please use an official institutional account (@${STUDENT_DOMAIN} or @udd.edu.ph).`);
        setLoading(false);
        return;
      }

      let user;
      try {
        const result = await signInWithEmailAndPassword(auth, formattedEmail, passwordInput);
        user = result.user;
      } catch (signInError) {
        if (
          signInError.code === "auth/user-not-found" || 
          signInError.code === "auth/invalid-credential"
        ) {
          try {
            const createResult = await createUserWithEmailAndPassword(auth, formattedEmail, passwordInput);
            user = createResult.user;
          } catch (createError) {
            if (createError.code === "auth/email-already-in-use") {
              setAuthError("Incorrect password. Default password is Universidad2026.");
            } else {
              setAuthError(createError.message || "Failed to authenticate.");
            }
            setLoading(false);
            return;
          }
        } else if (signInError.code === "auth/wrong-password" || signInError.code === "auth/invalid-login-credentials") {
          setAuthError("Incorrect password. Default password is Universidad2026.");
          setLoading(false);
          return;
        } else if (signInError.code === "auth/operation-not-allowed") {
          setAuthError("Email/Password provider is disabled in Firebase Console.");
          setLoading(false);
          return;
        } else {
          setAuthError("Invalid email or password. Please check your credentials.");
          setLoading(false);
          return;
        }
      }

      // Strictly isolate user document using user.uid
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const assignedRole = deriveRoleFromEmail(formattedEmail);

      if (!userSnap.exists()) {
        const newProfile = {
          uid: user.uid,
          email: user.email,
          displayName: formattedEmail.split("@")[0],
          role: assignedRole,
          firstName: "",
          middleName: "",
          lastName: "",
          studentId: "",
          section: "",
          contactNumber: "",
          photoURL: user.photoURL || "",
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
      } else {
        setUserProfile(userSnap.data());
      }
      setCurrentUser(user);
    } catch (error) {
      console.error("Login error:", error);
      setAuthError(error.message || "Failed to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("No authenticated user found.");

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      return { success: true };
    } catch (error) {
      console.error("Password update error:", error);
      throw error;
    }
  };

  const updateUserProfile = async (updatedData) => {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user.");
    try {
      // Strictly write to the unique user ID document path
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, updatedData);
      setUserProfile((prev) => ({ ...prev, ...updatedData }));
      return { success: true };
    } catch (error) {
      console.error("Profile update error:", error);
      throw error;
    }
  };

  const updateAvatar = async (file) => {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user.");

    try {
      const fileRef = ref(storage, `avatars/${user.uid}/${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const photoURL = await getDownloadURL(snapshot.ref);

      await updateProfile(user, { photoURL });

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { photoURL });

      setUserProfile((prev) => ({ ...prev, photoURL }));
      setCurrentUser({ ...user, photoURL });

      return photoURL;
    } catch (error) {
      console.error("Avatar upload error:", error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setCurrentUser(user);
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          } else {
            // Fallback initialization if auth exists but firestore doc is missing
            const assignedRole = deriveRoleFromEmail(user.email);
            const newProfile = {
              uid: user.uid,
              email: user.email,
              displayName: user.email ? user.email.split("@")[0] : "",
              role: assignedRole,
              firstName: "",
              middleName: "",
              lastName: "",
              studentId: "",
              section: "",
              contactNumber: "",
              photoURL: user.photoURL || "",
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      user: currentUser,        
      userProfile, 
      profile: userProfile,     
      loginWithEmail, 
      logout, 
      changePassword,
      updateUserProfile,
      updateAvatar,
      authError, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);