// TEMP-DEVTEST: the admin's sign-in log on made-up sign-ins (nothing reaches Firebase). Internet
// addresses are from the documentation ranges (192.0.2.x, 198.51.100.x, 203.0.113.x).
export {
  NO_PLACE, describeDevice, placeName, shortPlace, signInFlags, FLAG_TEXT, FLAG_HELP, placeFromGeoJs, placeFromIpWho,
} from "/src/lab/SignIns.js?real";

const H = 36e5;
const NOW = Date.now();
const PLACES = {
  dagupan: ["Dagupan City", "Ilocos", "Philippines", "PH", 16.04, 120.34, "PLDT Inc.", "Asia/Manila", "203.0.113.24"],
  lingayen: ["Lingayen", "Ilocos", "Philippines", "PH", 16.02, 120.23, "Dagupan Urban Satellite Vision Inc.", "Asia/Manila", "198.51.100.61"],
  calasiao: ["Calasiao", "Ilocos", "Philippines", "PH", 16.01, 120.36, "Globe Telecom", "Asia/Manila", "203.0.113.90"],
  urdaneta: ["Urdaneta City", "Ilocos", "Philippines", "PH", 15.98, 120.57, "Converge ICT Solutions", "Asia/Manila", "198.51.100.17"],
  sancarlos: ["San Carlos City", "Ilocos", "Philippines", "PH", 15.93, 120.35, "Smart Communications", "Asia/Manila", "192.0.2.140"],
  baguio: ["Baguio City", "Cordillera", "Philippines", "PH", 16.41, 120.6, "Globe Telecom", "Asia/Manila", "192.0.2.77"],
  amsterdam: ["Amsterdam", "North Holland", "Netherlands", "NL", 52.37, 4.9, "Datacamp Limited", "Europe/Amsterdam", "198.51.100.200"],
};
const ACCOUNTS = {
  adm1: ["admin@cdd.edu.ph", "dagupan", "Edge on Windows"],
  inst1: ["rsantos@cdd.edu.ph", "dagupan", "Chrome on Mac"],
  inst2: ["rvillanueva@cdd.edu.ph", "urdaneta", "Chrome on Windows"],
  stu1: ["jdelacruz@cdd.edu.ph", "dagupan", "Chrome on Android"],
  stu2: ["mreyes@cdd.edu.ph", "lingayen", "Chrome on Windows"],
  stu3: ["abautista@cdd.edu.ph", "calasiao", "Samsung Internet on Android"],
  stu4: ["pmendoza@cdd.edu.ph", "sancarlos", "Chrome on Android"],
  stu5: ["kgarcia@cdd.edu.ph", "dagupan", "Safari on iPhone"],
};

let n = 0;
function signIn(uid, hoursAgo, placeKey, device, timezone = "Asia/Manila") {
  const [email] = ACCOUNTS[uid];
  const [city, region, country, countryCode, lat, lon, isp, ipTimezone, ip] = PLACES[placeKey];
  n += 1;
  return { id: `s${n}`, uid, email, at: new Date(NOW - hoursAgo * H), ip, city, region, country, countryCode, lat, lon, isp, ipTimezone, device, timezone };
}

const LIST = [];
// every account, most school days, from home or school, on its usual device
const hours = [8.5, 10, 13, 15.5];
for (let day = 13; day >= 0; day -= 1) {
  Object.entries(ACCOUNTS).forEach(([uid, [, place, device]], i) => {
    if ((day + i) % 3 === 0) return; // not every day
    const h = day * 24 + (24 - hours[(day + i) % hours.length]) + i * 0.1;
    LIST.push(signIn(uid, h, (day + i) % 4 === 0 && uid.startsWith("stu") ? "dagupan" : place, device));
  });
}
// what an admin should notice
LIST.push(signIn("stu1", 2, "amsterdam", "Chrome on Windows")); // Juan: abroad, through a VPN, on a new device
LIST.push(signIn("stu2", 26, "lingayen", "Safari on iPhone")); // Maria: a new phone
LIST.push(signIn("stu4", 50, "baguio", "Chrome on Android")); // Paolo: away from home
LIST.sort((a, b) => b.at - a.at);

const PAGE = 25;
export async function recordSignIn() {}
export async function lookUpPlace() {
  return { ip: "", city: "", region: "", country: "", countryCode: "", lat: null, lon: null, isp: "", ipTimezone: "" };
}
export async function loadSignIns({ before = null } = {}) {
  const all = before ? LIST.filter((s) => s.at < before) : LIST;
  return { list: all.slice(0, PAGE), more: all.length > PAGE };
}
export async function loadSignInsOf(uid) {
  return LIST.filter((s) => s.uid === uid);
}
export async function loadLastSignIns() {
  const out = {};
  for (const s of LIST) if (!out[s.uid]) out[s.uid] = s;
  return out;
}
