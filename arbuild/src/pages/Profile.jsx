import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Profile.css";

export default function Profile() {
  const { profile, user, signOut } = useAuth();

  return (
    <div className="profile">
      <div className="profile__panel">
        <Link to="/main" className="profile__back focus-ring">← Back</Link>

        <div className="profile__head">
          {user?.photoURL && (
            <img className="profile__avatar" src={user.photoURL} alt="" />
          )}
          <div>
            <h1 className="profile__name">
              {profile?.firstName} {profile?.middleName} {profile?.lastName}
            </h1>
            <p className="profile__email">{profile?.email}</p>
          </div>
        </div>

        <div className="pin-divider" />

        <dl className="profile__meta">
          <div>
            <dt>Year &amp; Block</dt>
            <dd>{profile?.section}</dd>
          </div>
        </dl>

        <button className="profile__logout focus-ring" onClick={signOut}>
          Log out
        </button>
      </div>
    </div>
  );
}
