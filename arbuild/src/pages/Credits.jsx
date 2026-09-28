import { Link } from "react-router-dom";
import "../styles/Credits.css";

const ASSETS = [
  {
    name: "Fractal Design Meshify C — PC Case",
    creator: "MUSHROOM_BUILDS",
    url: "https://skfb.ly/6ZrH9",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
  {
    name: "MAXIMUS VI Formula (Motherboard)",
    creator: "Vivien Deroche",
    url: "https://skfb.ly/6SDPK",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
  {
    name: "Kingston Fury Beast DDR5 RAM Stick",
    creator: "Darky Vip 3D",
    url: "https://skfb.ly/pMxZQ",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
];

export default function Credits() {
  return (
    <div className="credits">
      <Link to="/main" className="credits__back focus-ring">← Main menu</Link>

      <p className="eyebrow">Attribution</p>
      <h1 className="credits__title">3D Asset Credits</h1>
      <p className="credits__intro">
        ARBuild uses third-party 3D models under Creative Commons licenses.
        We're grateful to these creators for making their work freely available.
      </p>

      <div className="pin-divider" />

      <ul className="credits__list">
        {ASSETS.map((asset) => (
          <li key={asset.url} className="credits__item">
            <p className="credits__name">{asset.name}</p>
            <p className="credits__creator">
              by <a href={asset.url} target="_blank" rel="noopener noreferrer">{asset.creator}</a>
            </p>
            <a href={asset.licenseUrl} target="_blank" rel="noopener noreferrer" className="credits__license">
              Licensed under {asset.license}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}