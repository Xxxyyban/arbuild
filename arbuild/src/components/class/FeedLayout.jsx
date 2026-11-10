// The signed-in pages' shared class feed (App.jsx puts them all under this route). It stays up while
// the person moves from page to page, so the bell, the to-do lists and the calendar on every page read
// one set of listeners (ClassFeed.jsx for a student, TeachingFeed.jsx for an instructor) instead of
// each page opening its own. Signing out, or leaving for a page outside it, closes them.
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ClassFeedProvider } from "./ClassFeed";
import { TeachingFeedProvider } from "./TeachingFeed";

export default function FeedLayout() {
  const { user, profile } = useAuth();
  if (!profile) return <Outlet />; // not known yet, or signed out: the page's own gate deals with it
  const Feed = profile.role === "faculty" ? TeachingFeedProvider : ClassFeedProvider;
  return (
    <Feed user={user} profile={profile}>
      <Outlet />
    </Feed>
  );
}
