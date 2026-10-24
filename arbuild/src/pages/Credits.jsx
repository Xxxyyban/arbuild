// The 3D models ARBuild uses under Creative Commons licences, and who made them.
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";

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
  {
    name: "Power supply Aerocool KCAS 500W ATX",
    creator: "nofurion",
    url: "https://skfb.ly/p9CIw",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
  {
    name: "DDR5 RAM - Teamgroup T-Force Black",
    creator: "PolyDavid",
    url: "https://skfb.ly/pIOSZ",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
  {
    name: "Samsung 990 PRO SSD",
    creator: "PolyDavid",
    url: "https://skfb.ly/pKpq9",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
  {
    name: "AM4 Cpu [ Free ]",
    creator: "Igor.Jop",
    url: "https://skfb.ly/pqx6R",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
  {
    name: "AMD Ryzen 5 7600X - HIGH POLY",
    creator: "PolyDavid",
    url: "https://skfb.ly/pKoWp",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
  {
    name: "RTX 3060 TI EAGLE",
    creator: "BlenderFace",
    url: "https://skfb.ly/oQUIt",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
  {
    name: "GPU AMD RX 6700 XT",
    creator: "BlenderFace",
    url: "https://skfb.ly/oRoEF",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
  {
    name: "Cooler Master CPU Cooler",
    creator: "BlenderFace",
    url: "https://skfb.ly/oQV6T",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
  {
    name: "(Free) AMD Wraith Stealth CPU Cooler",
    creator: "PolyDavid",
    url: "https://skfb.ly/pJXNM",
    license: "CC Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
  },
];

export default function Credits() {
  return (
    <AppShell
      className="app-page--content"
      eyebrow="Attribution"
      title="3D model credits"
      subtitle="ARBuild uses 3D models shared under Creative Commons licences. Thank you to the people who made them."
    >
      <ul className="credits-list">
        {ASSETS.map((asset) => (
          <li key={asset.url} className="ins-panel">
            <strong>{asset.name}</strong>
            <span className="ins-muted">
              by{" "}
              <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-link">
                {asset.creator}
              </a>
            </span>
            <a href={asset.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-link">
              <Icon name="award" size={14} />
              {asset.license}
            </a>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
