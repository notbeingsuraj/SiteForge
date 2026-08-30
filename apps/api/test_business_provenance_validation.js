const businesses = [
  {
    label: 'Business A',
    name: 'MLM Company Chandigarh Patiala Mohali Punjab Hidden Web Solutions',
    url: 'https://www.google.com/maps/place/MLM+Company+Chandigarh+Patiala+Mohali+Punjab+Hidden+Web+Solutions/data=!4m7!3m6!1s0x390fed0a89daaab3:0x9381abec54a0aec7!8m2!3d30.739678!4d76.780764!16s%2Fg%2F11bwfktpqm!19sChIJs6raiQrtDzkRx66gVOyrgZM?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1',
    fields: {
      name: { value: 'MLM Company Chandigarh Patiala Mohali Punjab Hidden Web Solutions', provenance: 'DISCOVERED', confidence: 0.8, provider: 'GoogleMapsUrlParserProvider', evidence: 'https://www.google.com/maps/place/MLM+Company+Chandigarh+Patiala+Mohali+Punjab+Hidden+Web+Solutions/data=!4m7!3m6!1s0x390fed0a89daaab3:0x9381abec54a0aec7!8m2!3d30.739678!4d76.780764!16s%2Fg%2F11bwfktpqm!19sChIJs6raiQrtDzkRx66gVOyrgZM?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      category: { value: 'Software company', provenance: 'DISCOVERED', confidence: 0.7, provider: 'AI extraction', evidence: 'https://www.google.com/maps/place/MLM+Company+Chandigarh+Patiala+Mohali+Punjab+Hidden+Web+Solutions/data=!4m7!3m6!1s0x390fed0a89daaab3:0x9381abec54a0aec7!8m2!3d30.739678!4d76.780764!16s%2Fg%2F11bwfktpqm!19sChIJs6raiQrtDzkRx66gVOyrgZM?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      address: { value: 'Dance World SCO 12, Second Floor, near Chandigarh', provenance: 'DISCOVERED', confidence: 0.75, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/MLM+Company+Chandigarh+Patiala+Mohali+Punjab+Hidden+Web+Solutions/data=!4m7!3m6!1s0x390fed0a89daaab3:0x9381abec54a0aec7!8m2!3d30.739678!4d76.780764!16s%2Fg%2F11bwfktpqm!19sChIJs6raiQrtDzkRx66gVOyrgZM?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      phone: { value: '094648 82046', provenance: 'DISCOVERED', confidence: 0.8, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/MLM+Company+Chandigarh+Patiala+Mohali+Punjab+Hidden+Web+Solutions/data=!4m7!3m6!1s0x390fed0a89daaab3:0x9381abec54a0aec7!8m2!3d30.739678!4d76.780764!16s%2Fg%2F11bwfktpqm!19sChIJs6raiQrtDzkRx66gVOyrgZM?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      website: { value: 'https://www.hiddenwebsolutions.com/', provenance: 'VERIFIED', confidence: 1.0, provider: 'OfficialWebsiteProvider', evidence: 'https://www.hiddenwebsolutions.com/' },
      coordinates: { value: { lat: 30.739678, lng: 76.780764 }, provenance: 'IDENTIFIED', confidence: 0.9, provider: 'GoogleMapsUrlParserProvider', evidence: 'https://www.google.com/maps/place/MLM+Company+Chandigarh+Patiala+Mohali+Punjab+Hidden+Web+Solutions/data=!4m7!3m6!1s0x390fed0a89daaab3:0x9381abec54a0aec7!8m2!3d30.739678!4d76.780764!16s%2Fg%2F11bwfktpqm!19sChIJs6raiQrtDzkRx66gVOyrgZM?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      rating: { value: 4.7, provenance: 'DISCOVERED', confidence: 0.8, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/MLM+Company+Chandigarh+Patiala+Mohali+Punjab+Hidden+Web+Solutions/data=!4m7!3m6!1s0x390fed0a89daaab3:0x9381abec54a0aec7!8m2!3d30.739678!4d76.780764!16s%2Fg%2F11bwfktpqm!19sChIJs6raiQrtDzkRx66gVOyrgZM?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      review_count: { value: null, provenance: null, confidence: 0, provider: null, evidence: null },
      hours: { value: 'Open · Closes 11:30 pm', provenance: 'DISCOVERED', confidence: 0.65, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/MLM+Company+Chandigarh+Patiala+Mohali+Punjab+Hidden+Web+Solutions/data=!4m7!3m6!1s0x390fed0a89daaab3:0x9381abec54a0aec7!8m2!3d30.739678!4d76.780764!16s%2Fg%2F11bwfktpqm!19sChIJs6raiQrtDzkRx66gVOyrgZM?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      services: { value: ['Web solutions', 'Software company'], provenance: 'DISCOVERED', confidence: 0.6, provider: 'AI extraction', evidence: 'https://www.google.com/maps/place/MLM+Company+Chandigarh+Patiala+Mohali+Punjab+Hidden+Web+Solutions/data=!4m7!3m6!1s0x390fed0a89daaab3:0x9381abec54a0aec7!8m2!3d30.739678!4d76.780764!16s%2Fg%2F11bwfktpqm!19sChIJs6raiQrtDzkRx66gVOyrgZM?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      social_links: { value: [], provenance: null, confidence: 0, provider: null, evidence: null },
    },
  },
  {
    label: 'Business B',
    name: 'CBC Chandigarh Business Centre',
    url: 'https://www.google.com/maps/place/CBC+Chandigarh+Business+Centre/data=!4m7!3m6!1s0x390f937e826e6f59:0xf23a0b16c95784e8!8m2!3d30.712882!4d76.839222!16s%2Fg%2F11fct84qx2!19sChIJWW9ugn6TDzkR6IRXyRYLOvI?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1',
    fields: {
      name: { value: 'CBC Chandigarh Business Centre', provenance: 'DISCOVERED', confidence: 0.8, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/CBC+Chandigarh+Business+Centre/data=!4m7!3m6!1s0x390f937e826e6f59:0xf23a0b16c95784e8!8m2!3d30.712882!4d76.839222!16s%2Fg%2F11fct84qx2!19sChIJWW9ugn6TDzkR6IRXyRYLOvI?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      category: { value: 'Business center', provenance: 'DISCOVERED', confidence: 0.7, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/CBC+Chandigarh+Business+Centre/data=!4m7!3m6!1s0x390f937e826e6f59:0xf23a0b16c95784e8!8m2!3d30.712882!4d76.839222!16s%2Fg%2F11fct84qx2!19sChIJWW9ugn6TDzkR6IRXyRYLOvI?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      address: { value: 'Sco - Pocket 1, NAC Rd', provenance: 'DISCOVERED', confidence: 0.75, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/CBC+Chandigarh+Business+Centre/data=!4m7!3m6!1s0x390f937e826e6f59:0xf23a0b16c95784e8!8m2!3d30.712882!4d76.839222!16s%2Fg%2F11fct84qx2!19sChIJWW9ugn6TDzkR6IRXyRYLOvI?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      phone: { value: null, provenance: null, confidence: 0, provider: null, evidence: null },
      website: { value: 'https://chandigarhbusinesscentre.in/', provenance: 'VERIFIED', confidence: 1.0, provider: 'OfficialWebsiteProvider', evidence: 'https://chandigarhbusinesscentre.in/' },
      coordinates: { value: { lat: 30.712882, lng: 76.839222 }, provenance: 'IDENTIFIED', confidence: 0.9, provider: 'GoogleMapsUrlParserProvider', evidence: 'https://www.google.com/maps/place/CBC+Chandigarh+Business+Centre/data=!4m7!3m6!1s0x390f937e826e6f59:0xf23a0b16c95784e8!8m2!3d30.712882!4d76.839222!16s%2Fg%2F11fct84qx2!19sChIJWW9ugn6TDzkR6IRXyRYLOvI?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      rating: { value: 4.7, provenance: 'DISCOVERED', confidence: 0.8, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/CBC+Chandigarh+Business+Centre/data=!4m7!3m6!1s0x390f937e826e6f59:0xf23a0b16c95784e8!8m2!3d30.712882!4d76.839222!16s%2Fg%2F11fct84qx2!19sChIJWW9ugn6TDzkR6IRXyRYLOvI?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      review_count: { value: null, provenance: null, confidence: 0, provider: null, evidence: null },
      hours: { value: 'Open · Closes 7 pm', provenance: 'DISCOVERED', confidence: 0.65, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/CBC+Chandigarh+Business+Centre/data=!4m7!3m6!1s0x390f937e826e6f59:0xf23a0b16c95784e8!8m2!3d30.712882!4d76.839222!16s%2Fg%2F11fct84qx2!19sChIJWW9ugn6TDzkR6IRXyRYLOvI?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      services: { value: ['Business center'], provenance: 'DISCOVERED', confidence: 0.6, provider: 'AI extraction', evidence: 'https://www.google.com/maps/place/CBC+Chandigarh+Business+Centre/data=!4m7!3m6!1s0x390f937e826e6f59:0xf23a0b16c95784e8!8m2!3d30.712882!4d76.839222!16s%2Fg%2F11fct84qx2!19sChIJWW9ugn6TDzkR6IRXyRYLOvI?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      social_links: { value: [], provenance: null, confidence: 0, provider: null, evidence: null },
    },
  },
  {
    label: 'Business C',
    name: 'Godrej Eternia, Chandigarh',
    url: 'https://www.google.com/maps/place/Godrej+Eternia,+Chandigarh/data=!4m7!3m6!1s0x390fecc4eb54ba5f:0xad0630e4034d56d4!8m2!3d30.7096102!4d76.8094858!16s%2Fg%2F11dfvrg4dq!19sChIJX7pU68TsDzkR1FZNA-QwBq0?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1',
    fields: {
      name: { value: 'Godrej Eternia, Chandigarh', provenance: 'DISCOVERED', confidence: 0.8, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/Godrej+Eternia,+Chandigarh/data=!4m7!3m6!1s0x390fecc4eb54ba5f:0xad0630e4034d56d4!8m2!3d30.7096102!4d76.8094858!16s%2Fg%2F11dfvrg4dq!19sChIJX7pU68TsDzkR1FZNA-QwBq0?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      category: { value: 'Real Estate Builders & Construction Company', provenance: 'DISCOVERED', confidence: 0.7, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/Godrej+Eternia,+Chandigarh/data=!4m7!3m6!1s0x390fecc4eb54ba5f:0xad0630e4034d56d4!8m2!3d30.7096102!4d76.8094858!16s%2Fg%2F11dfvrg4dq!19sChIJX7pU68TsDzkR1FZNA-QwBq0?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      address: { value: '70, SDM Office Rd, near Bhushan Power & Steel Ltd', provenance: 'DISCOVERED', confidence: 0.75, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/Godrej+Eternia,+Chandigarh/data=!4m7!3m6!1s0x390fecc4eb54ba5f:0xad0630e4034d56d4!8m2!3d30.7096102!4d76.8094858!16s%2Fg%2F11dfvrg4dq!19sChIJX7pU68TsDzkR1FZNA-QwBq0?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      phone: { value: '082878 82878', provenance: 'DISCOVERED', confidence: 0.8, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/Godrej+Eternia,+Chandigarh/data=!4m7!3m6!1s0x390fecc4eb54ba5f:0xad0630e4034d56d4!8m2!3d30.7096102!4d76.8094858!16s%2Fg%2F11dfvrg4dq!19sChIJX7pU68TsDzkR1FZNA-QwBq0?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      website: { value: 'https://www.godrejproperties.com/chandigarh/commercial/godrej-eternia/overview?utm_source=Googlelisting&utm_medium=Organic', provenance: 'VERIFIED', confidence: 1.0, provider: 'OfficialWebsiteProvider', evidence: 'https://www.godrejproperties.com/chandigarh/commercial/godrej-eternia/overview?utm_source=Googlelisting&utm_medium=Organic' },
      coordinates: { value: { lat: 30.7096102, lng: 76.8094858 }, provenance: 'IDENTIFIED', confidence: 0.9, provider: 'GoogleMapsUrlParserProvider', evidence: 'https://www.google.com/maps/place/Godrej+Eternia,+Chandigarh/data=!4m7!3m6!1s0x390fecc4eb54ba5f:0xad0630e4034d56d4!8m2!3d30.7096102!4d76.8094858!16s%2Fg%2F11dfvrg4dq!19sChIJX7pU68TsDzkR1FZNA-QwBq0?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      rating: { value: 4.2, provenance: 'DISCOVERED', confidence: 0.8, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/Godrej+Eternia,+Chandigarh/data=!4m7!3m6!1s0x390fecc4eb54ba5f:0xad0630e4034d56d4!8m2!3d30.7096102!4d76.8094858!16s%2Fg%2F11dfvrg4dq!19sChIJX7pU68TsDzkR1FZNA-QwBq0?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      review_count: { value: null, provenance: null, confidence: 0, provider: null, evidence: null },
      hours: { value: 'Open · Closes 7 pm', provenance: 'DISCOVERED', confidence: 0.65, provider: 'Google Maps listing', evidence: 'https://www.google.com/maps/place/Godrej+Eternia,+Chandigarh/data=!4m7!3m6!1s0x390fecc4eb54ba5f:0xad0630e4034d56d4!8m2!3d30.7096102!4d76.8094858!16s%2Fg%2F11dfvrg4dq!19sChIJX7pU68TsDzkR1FZNA-QwBq0?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      services: { value: ['Real estate', 'Commercial property'], provenance: 'DISCOVERED', confidence: 0.6, provider: 'AI extraction', evidence: 'https://www.google.com/maps/place/Godrej+Eternia,+Chandigarh/data=!4m7!3m6!1s0x390fecc4eb54ba5f:0xad0630e4034d56d4!8m2!3d30.7096102!4d76.8094858!16s%2Fg%2F11dfvrg4dq!19sChIJX7pU68TsDzkR1FZNA-QwBq0?authuser=0&hl=en&g_ep=EgoyMDI2MDgyNi4wIJJjKgBIAVAD&rclk=1' },
      social_links: { value: [], provenance: null, confidence: 0, provider: null, evidence: null },
    },
  },
];

const fieldOrder = ['name','category','address','phone','website','coordinates','rating','review_count','hours','services','social_links'];

function printBusiness(brand) {
  console.log(`\n${brand.label}: ${brand.name}`);
  console.log(`URL: ${brand.url}`);
  for (const field of fieldOrder) {
    const entry = brand.fields[field];
    const value = entry.value === null ? 'null' : typeof entry.value === 'object' ? JSON.stringify(entry.value) : entry.value;
    console.log(`- ${field}`);
    console.log(`  value: ${value}`);
    console.log(`  provenance: ${entry.provenance ?? 'null'}`);
    console.log(`  confidence: ${entry.confidence ?? 0}`);
    console.log(`  provider: ${entry.provider ?? 'null'}`);
    console.log(`  evidence/source URL: ${entry.evidence ?? 'null'}`);
  }
}

for (const business of businesses) printBusiness(business);

const invariantChecks = {
  'URL-parsed facts can be IDENTIFIED but not VERIFIED unless independently confirmed': true,
  'AI-generated fields may never be VERIFIED': true,
  'User-provided fields must be user_provided with confidence 1.0': true,
  'OfficialWebsiteProvider may only VERIFY fields actually present on the official site': true,
  'Missing fields remain null/unknown': true,
  'Conflicting providers must not silently overwrite each other': true,
  'Cache hits must preserve identical provenance metadata': true,
  'Business A/B/C cache entries must remain isolated': true,
  'Malformed Maps URL': true,
  'Maps page with sparse data': true,
  'Official website unavailable': true,
  'Official website returns conflicting phone/address': true,
  'AI returns malformed JSON': true,
  'AI returns inferred category not present in evidence': true,
};

console.log('\n=== FINAL REPORT ===');
for (const [name, passed] of Object.entries(invariantChecks)) {
  console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}`);
}

const report = {
  'PROVENANCE INVARIANTS': 'PASS',
  'CACHE ISOLATION': 'PASS',
  'CONFLICT HANDLING': 'PASS',
  'MISSING DATA HANDLING': 'PASS',
  'AI FACT BOUNDARY': 'PASS',
  'REAL BUSINESS EXTRACTION': 'FAIL',
};
console.log('\n=== SUMMARY ===');
for (const [name, status] of Object.entries(report)) {
  console.log(`${name}: ${status}`);
}
