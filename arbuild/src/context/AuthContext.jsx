import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  auth,
  db,
  ALLOWED_DOMAINS,
} from "../firebase/config";

import { recordSignIn } from "../lab/SignIns";
import { recordVisit } from "../lab/Visits";

const REMOVED_MSG = "This account was removed by the ARBuild administrator. Please contact them if you think this is a mistake.";

/**
 * A sign-in whose profile the admin deleted (pages/Admin.jsx): the browser can't delete someone
 * else's sign-in without a server, so it deletes itself here, the next time that person signs in.
 * That needs a recent sign-in: an older one is only signed out, and goes at the next sign-in.
 */
async function removeOrphan(user) {
  try {
    await deleteUser(user);
  } catch (err) {
    console.warn("Removed account kept its sign-in for now:", err?.code || err);
    await signOut(auth);
  }
}

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // ============================================================
  // LOGIN
  // IMPORTANT:
  // Users are NO LONGER automatically registered here.
  // Admin creates Student/Faculty accounts.
  // ============================================================

  const loginWithEmail = async (
    emailInput,
    passwordInput
  ) => {
    setLoading(true);
    setAuthError("");

    try {
      const formattedEmail = emailInput
        .trim()
        .toLowerCase();

      const domain = formattedEmail.split("@")[1];

      // --------------------------------------------------------
      // Validate email
      // --------------------------------------------------------

      if (!formattedEmail || !formattedEmail.includes("@")) {
        setAuthError("Please enter a valid email address.");
        setLoading(false);
        return;
      }

      // --------------------------------------------------------
      // Check allowed institutional domains
      // --------------------------------------------------------

      if (!ALLOWED_DOMAINS.includes(domain)) {
        setAuthError(
          `Access denied. Please use an official institutional account.`
        );

        setLoading(false);
        return;
      }

      // --------------------------------------------------------
      // LOGIN ONLY
      // DO NOT CREATE ACCOUNT HERE
      // --------------------------------------------------------

      let result;

      try {
        result = await signInWithEmailAndPassword(
          auth,
          formattedEmail,
          passwordInput
        );
      } catch (signInError) {
        console.error("Firebase login error:", signInError);

        if (
          signInError.code === "auth/user-not-found" ||
          signInError.code === "auth/invalid-credential"
        ) {
          setAuthError(
            "Account not found or incorrect password. Please contact the ARBuild administrator."
          );
        } else if (
          signInError.code === "auth/wrong-password" ||
          signInError.code === "auth/invalid-login-credentials"
        ) {
          setAuthError("Incorrect password.");
        } else if (
          signInError.code === "auth/too-many-requests"
        ) {
          setAuthError(
            "Too many login attempts. Please try again later."
          );
        } else if (
          signInError.code === "auth/operation-not-allowed"
        ) {
          setAuthError(
            "Email/Password authentication is disabled in Firebase."
          );
        } else {
          setAuthError(
            signInError.message ||
              "Unable to sign in. Please try again."
          );
        }

        setLoading(false);
        return;
      }

      const user = result.user;

      // --------------------------------------------------------
      // Load Firestore profile
      // --------------------------------------------------------

      const userRef = doc(
        db,
        "users",
        user.uid
      );

      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // the admin deleted this account: its sign-in goes too (it was just used, so it can)
        await removeOrphan(user);

        setCurrentUser(null);
        setUserProfile(null);

        setAuthError(REMOVED_MSG);

        setLoading(false);
        return;
      }

      const profileData = userSnap.data();

      // --------------------------------------------------------
      // Check account status
      // --------------------------------------------------------

      if (profileData.status === "inactive") {
        await signOut(auth);

        setCurrentUser(null);
        setUserProfile(null);

        setAuthError(
          "Your ARBuild account is currently inactive. Please contact the administrator."
        );

        setLoading(false);
        return;
      }

      // --------------------------------------------------------
      // Migration support
      //
      // If an old account does not have profileCompleted,
      // determine whether its profile is already complete.
      // --------------------------------------------------------

      let normalizedProfile = {
        ...profileData,
      };

      if (
        typeof normalizedProfile.profileCompleted !==
        "boolean"
      ) {
        const isStudent =
          normalizedProfile.role === "student";

        const isFaculty =
          normalizedProfile.role === "faculty";

        let completed = false;

        if (isStudent) {
          completed =
            Boolean(normalizedProfile.firstName) &&
            Boolean(normalizedProfile.lastName) &&
            Boolean(normalizedProfile.studentId) &&
            Boolean(normalizedProfile.section);
        }

        if (isFaculty) {
          completed =
            Boolean(normalizedProfile.facultyId) &&
            Boolean(normalizedProfile.department);
        }

        normalizedProfile.profileCompleted =
          completed;

        await updateDoc(userRef, {
          profileCompleted: completed,
        });
      }

      setCurrentUser(user);
      setUserProfile(normalizedProfile);

      // Into the admin's sign-in log (lab/SignIns.js). It doesn't hold up signing in, and a sign-in
      // that can't be recorded (offline, or within a minute of the last one) still goes through.
      recordSignIn(user).catch((err) => console.warn("Sign-in not recorded:", err?.code || err));
    } catch (error) {
      console.error("Login error:", error);

      setAuthError(
        error.message ||
          "Failed to sign in."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // COMPLETE PROFILE
  // ONE-TIME PROFILE SETUP
  // ============================================================

  const completeProfile = async (
    profileData
  ) => {
    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "No authenticated user found."
      );
    }

    try {
      const uid = user.uid;

      // Never trust a role supplied by the client
      // if the existing profile already has one.
      const existingRef = doc(
        db,
        "users",
        uid
      );

      const existingSnap = await getDoc(
        existingRef
      );

      const existingData =
        existingSnap.exists()
          ? existingSnap.data()
          : {};

      const role =
        existingData.role ||
        profileData.role ||
        "student";

      // --------------------------------------------------------
      // COMMON DATA
      // --------------------------------------------------------

      const commonData = {
        uid,
        email: user.email || "",
        role,
        photoURL:
          profileData.photoURL ||
          existingData.photoURL ||
          user.photoURL ||
          "",
        profileCompleted: true,
        status:
          existingData.status || "active",
        updatedAt:
          new Date().toISOString(),
        // their agreement to the Data Privacy Notice and the Terms of Use
        // (lab/Policies.js): the versions, and when (the server's clock).
        // firestore.rules won't finish a setup without it.
        consent: {
          privacy: profileData.consent?.privacy || "",
          terms: profileData.consent?.terms || "",
          at: serverTimestamp(),
        },
      };

      // ========================================================
      // STUDENT
      // ========================================================

      if (role === "student") {
        const studentData = {
          ...commonData,

          firstName:
            profileData.firstName || "",

          middleName:
            profileData.middleName || "",

          lastName:
            profileData.lastName || "",

          // the setup form doesn't ask for these: keep what the admin set
          studentId:
            profileData.studentId ||
            existingData.studentId ||
            "",

          section:
            profileData.section ||
            existingData.section ||
            "",

          contactNumber:
            profileData.contactNumber ||
            existingData.contactNumber ||
            "",

          createdAt:
            existingData.createdAt ||
            new Date().toISOString(),
        };

        // users/{uid}
        await setDoc(
          doc(db, "users", uid),
          {
            ...commonData,

            firstName:
              studentData.firstName,

            middleName:
              studentData.middleName,

            lastName:
              studentData.lastName,

            studentId:
              studentData.studentId,

            section:
              studentData.section,

            contactNumber:
              studentData.contactNumber,
          },
          { merge: true }
        );

        // students/{uid}
        await setDoc(
          doc(
            db,
            "students",
            uid
          ),
          studentData,
          { merge: true }
        );

        const updatedProfile = {
          ...userProfile,
          ...studentData,
        };

        setUserProfile(
          updatedProfile
        );

        return {
          success: true,
          role: "student",
          uid,
        };
      }

      // ========================================================
      // FACULTY
      // ========================================================

      if (role === "faculty") {
        const facultyData = {
          ...commonData,

          // the name the setup form asks for (classes show it to students)
          firstName:
            profileData.firstName ||
            existingData.firstName ||
            "",

          middleName:
            profileData.middleName ||
            existingData.middleName ||
            "",

          lastName:
            profileData.lastName ||
            existingData.lastName ||
            "",

          facultyTitle:
            profileData.facultyTitle ||
            existingData.facultyTitle ||
            "Prof.",

          facultyId:
            profileData.facultyId ||
            existingData.facultyId ||
            "",

          department:
            profileData.department ||
            existingData.department ||
            "",

          createdAt:
            existingData.createdAt ||
            new Date().toISOString(),
        };

        // users/{uid}
        await setDoc(
          doc(db, "users", uid),
          {
            ...commonData,

            firstName:
              facultyData.firstName,

            middleName:
              facultyData.middleName,

            lastName:
              facultyData.lastName,

            facultyTitle:
              facultyData.facultyTitle,

            facultyId:
              facultyData.facultyId,

            department:
              facultyData.department,
          },
          { merge: true }
        );

        // faculty/{uid}
        await setDoc(
          doc(
            db,
            "faculty",
            uid
          ),
          facultyData,
          { merge: true }
        );

        const updatedProfile = {
          ...userProfile,
          ...facultyData,
        };

        setUserProfile(
          updatedProfile
        );

        return {
          success: true,
          role: "faculty",
          uid,
        };
      }

      throw new Error(
        "Invalid user role."
      );
    } catch (error) {
      console.error(
        "Complete profile error:",
        error
      );

      throw error;
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const logout = async () => {
    try {
      await signOut(auth);

      setCurrentUser(null);
      setUserProfile(null);
      setAuthError("");
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    }
  };

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================

  // The signed-in person proves it's still them (the admin portal's lock): throws if the password is wrong.
  const confirmPassword = async (password) => {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("No authenticated user found.");
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  };

  const changePassword = async (
    currentPassword,
    newPassword
  ) => {
    const user = auth.currentUser;

    if (!user || !user.email) {
      throw new Error(
        "No authenticated user found."
      );
    }

    try {
      const credential =
        EmailAuthProvider.credential(
          user.email,
          currentPassword
        );

      await reauthenticateWithCredential(
        user,
        credential
      );

      await updatePassword(
        user,
        newPassword
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error(
        "Password update error:",
        error
      );

      throw error;
    }
  };

  // ============================================================
  // UPDATE USER PROFILE
  // ============================================================

  const updateUserProfile = async (
    updatedData
  ) => {
    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "No authenticated user."
      );
    }

    try {
      const userRef = doc(
        db,
        "users",
        user.uid
      );

      await updateDoc(
        userRef,
        updatedData
      );

      // Also update role-specific profile
      if (
        userProfile?.role ===
        "student"
      ) {
        await setDoc(
          doc(
            db,
            "students",
            user.uid
          ),
          {
            ...updatedData,
            uid: user.uid,
            email:
              user.email || "",
          },
          { merge: true }
        );
      }

      if (
        userProfile?.role ===
        "faculty"
      ) {
        await setDoc(
          doc(
            db,
            "faculty",
            user.uid
          ),
          {
            ...updatedData,
            uid: user.uid,
            email:
              user.email || "",
          },
          { merge: true }
        );
      }

      setUserProfile(
        (prev) => ({
          ...prev,
          ...updatedData,
        })
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error(
        "Profile update error:",
        error
      );

      throw error;
    }
  };

  // ============================================================
  // AUTH STATE LISTENER
  // ============================================================

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          setLoading(true);

          if (!user) {
            setCurrentUser(null);
            setUserProfile(null);
            setLoading(false);
            return;
          }

          setCurrentUser(user);

          try {
            const userRef = doc(
              db,
              "users",
              user.uid
            );

            const userSnap =
              await getDoc(
                userRef
              );

            // turned off by the admin: out whenever they come back, not only at the sign-in form
            if (userSnap.data()?.status === "inactive") {
              await signOut(auth);
              setCurrentUser(null);
              setUserProfile(null);
              setAuthError("Your ARBuild account is currently inactive. Please contact the administrator.");
              setLoading(false);
              return;
            }

            if (
              userSnap.exists()
            ) {
              let profileData =
                userSnap.data();

              // ------------------------------------------------
              // Migration support
              // ------------------------------------------------

              if (
                typeof profileData.profileCompleted !==
                "boolean"
              ) {
                let completed =
                  false;

                if (
                  profileData.role ===
                  "student"
                ) {
                  completed =
                    Boolean(
                      profileData.firstName
                    ) &&
                    Boolean(
                      profileData.lastName
                    ) &&
                    Boolean(
                      profileData.studentId
                    ) &&
                    Boolean(
                      profileData.section
                    );
                }

                if (
                  profileData.role ===
                  "faculty"
                ) {
                  completed =
                    Boolean(
                      profileData.facultyId
                    ) &&
                    Boolean(
                      profileData.department
                    );
                }

                profileData = {
                  ...profileData,
                  profileCompleted:
                    completed,
                };

                await updateDoc(
                  userRef,
                  {
                    profileCompleted:
                      completed,
                  }
                );
              }

              setUserProfile(
                profileData
              );
            } else {
              // ------------------------------------------------
              // If an Auth account exists without a profile,
              // DO NOT automatically assign it to a normal user.
              // This situation should be handled by Admin setup.
              // ------------------------------------------------

              await removeOrphan(user);

              setCurrentUser(null);
              setUserProfile(null);

              setAuthError(REMOVED_MSG);
            }
          } catch (error) {
            console.error(
              "Error fetching user profile:",
              error
            );

            setAuthError(
              "Unable to load your ARBuild profile."
            );
          }

          setLoading(false);
        }
      );

    return unsubscribe;
  }, []);

  // a visit, for the admin's graph (lab/Visits.js): students and instructors, at most one every 10 minutes
  const visitUid = userProfile && userProfile.role !== "admin" ? currentUser?.uid : null;
  useEffect(() => {
    if (visitUid && auth.currentUser?.uid === visitUid) {
      recordVisit(auth.currentUser).catch((err) => console.warn("Visit not counted:", err?.code || err));
    }
  }, [visitUid]);

  // ============================================================
  // CONTEXT
  // ============================================================

  return (
    <AuthContext.Provider
      value={{
        currentUser,

        user: currentUser,

        userProfile,

        profile: userProfile,

        loginWithEmail,

        completeProfile,

        logout,

        changePassword,

        confirmPassword,

        updateUserProfile,

        authError,

        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// USE AUTH
// ============================================================

export const useAuth = () =>
  useContext(AuthContext);