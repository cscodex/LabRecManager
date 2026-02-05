// Indian States and Districts Data
// Comprehensive list of all states/UTs with major districts

export interface District {
    name: string;
    code: string;
}

export interface State {
    name: string;
    code: string;
    districts: District[];
}

export const indianStates: State[] = [
    {
        name: "Andhra Pradesh",
        code: "AP",
        districts: [
            { name: "Anantapur", code: "ATP" },
            { name: "Chittoor", code: "CTR" },
            { name: "East Godavari", code: "EGD" },
            { name: "Guntur", code: "GNT" },
            { name: "Krishna", code: "KRS" },
            { name: "Kurnool", code: "KNL" },
            { name: "Nellore", code: "NLR" },
            { name: "Prakasam", code: "PKM" },
            { name: "Srikakulam", code: "SKM" },
            { name: "Visakhapatnam", code: "VSP" },
            { name: "Vizianagaram", code: "VZM" },
            { name: "West Godavari", code: "WGD" },
            { name: "YSR Kadapa", code: "KDP" },
        ]
    },
    {
        name: "Arunachal Pradesh",
        code: "AR",
        districts: [
            { name: "Itanagar", code: "ITN" },
            { name: "Tawang", code: "TWG" },
            { name: "Pasighat", code: "PSG" },
        ]
    },
    {
        name: "Assam",
        code: "AS",
        districts: [
            { name: "Dibrugarh", code: "DBR" },
            { name: "Guwahati (Kamrup Metro)", code: "GHY" },
            { name: "Jorhat", code: "JRT" },
            { name: "Nagaon", code: "NGN" },
            { name: "Silchar", code: "SLC" },
            { name: "Tezpur", code: "TZP" },
        ]
    },
    {
        name: "Bihar",
        code: "BR",
        districts: [
            { name: "Araria", code: "ARA" },
            { name: "Begusarai", code: "BGS" },
            { name: "Bhagalpur", code: "BGP" },
            { name: "Darbhanga", code: "DBG" },
            { name: "Gaya", code: "GAY" },
            { name: "Muzaffarpur", code: "MZP" },
            { name: "Patna", code: "PAT" },
            { name: "Purnia", code: "PUR" },
            { name: "Samastipur", code: "SMP" },
            { name: "Vaishali", code: "VSL" },
        ]
    },
    {
        name: "Chhattisgarh",
        code: "CG",
        districts: [
            { name: "Bilaspur", code: "BSP" },
            { name: "Durg", code: "DRG" },
            { name: "Korba", code: "KRB" },
            { name: "Raipur", code: "RPR" },
            { name: "Rajnandgaon", code: "RJN" },
        ]
    },
    {
        name: "Delhi",
        code: "DL",
        districts: [
            { name: "Central Delhi", code: "CDL" },
            { name: "East Delhi", code: "EDL" },
            { name: "New Delhi", code: "NDL" },
            { name: "North Delhi", code: "NRD" },
            { name: "South Delhi", code: "SDL" },
            { name: "West Delhi", code: "WDL" },
        ]
    },
    {
        name: "Goa",
        code: "GA",
        districts: [
            { name: "North Goa", code: "NGA" },
            { name: "South Goa", code: "SGA" },
        ]
    },
    {
        name: "Gujarat",
        code: "GJ",
        districts: [
            { name: "Ahmedabad", code: "AMD" },
            { name: "Bharuch", code: "BRC" },
            { name: "Gandhinagar", code: "GNR" },
            { name: "Jamnagar", code: "JAM" },
            { name: "Rajkot", code: "RJK" },
            { name: "Surat", code: "SRT" },
            { name: "Vadodara", code: "VDR" },
        ]
    },
    {
        name: "Haryana",
        code: "HR",
        districts: [
            { name: "Ambala", code: "AMB" },
            { name: "Faridabad", code: "FBD" },
            { name: "Gurugram", code: "GGN" },
            { name: "Hisar", code: "HSR" },
            { name: "Karnal", code: "KNL" },
            { name: "Panipat", code: "PNP" },
            { name: "Rohtak", code: "RTK" },
            { name: "Sonipat", code: "SNP" },
        ]
    },
    {
        name: "Himachal Pradesh",
        code: "HP",
        districts: [
            { name: "Dharamshala (Kangra)", code: "DHS" },
            { name: "Kullu", code: "KLU" },
            { name: "Mandi", code: "MND" },
            { name: "Shimla", code: "SML" },
            { name: "Solan", code: "SLN" },
        ]
    },
    {
        name: "Jammu and Kashmir",
        code: "JK",
        districts: [
            { name: "Anantnag", code: "ANG" },
            { name: "Baramulla", code: "BRM" },
            { name: "Jammu", code: "JMU" },
            { name: "Srinagar", code: "SRN" },
            { name: "Udhampur", code: "UDH" },
        ]
    },
    {
        name: "Jharkhand",
        code: "JH",
        districts: [
            { name: "Bokaro", code: "BKR" },
            { name: "Dhanbad", code: "DHN" },
            { name: "Hazaribagh", code: "HZB" },
            { name: "Jamshedpur (East Singhbhum)", code: "JSR" },
            { name: "Ranchi", code: "RNC" },
        ]
    },
    {
        name: "Karnataka",
        code: "KA",
        districts: [
            { name: "Bagalkot", code: "BGK" },
            { name: "Bangalore Urban", code: "BLR" },
            { name: "Belgaum (Belagavi)", code: "BGM" },
            { name: "Bellary (Ballari)", code: "BLY" },
            { name: "Davangere", code: "DVG" },
            { name: "Dharwad", code: "DWD" },
            { name: "Gulbarga (Kalaburagi)", code: "GLB" },
            { name: "Hubli-Dharwad", code: "HBL" },
            { name: "Mangalore (Dakshina Kannada)", code: "MNG" },
            { name: "Mysore (Mysuru)", code: "MYS" },
            { name: "Shimoga (Shivamogga)", code: "SMG" },
            { name: "Tumkur", code: "TMK" },
        ]
    },
    {
        name: "Kerala",
        code: "KL",
        districts: [
            { name: "Alappuzha", code: "ALP" },
            { name: "Ernakulam", code: "EKM" },
            { name: "Kannur", code: "KNR" },
            { name: "Kochi", code: "KCH" },
            { name: "Kollam", code: "KLM" },
            { name: "Kottayam", code: "KTM" },
            { name: "Kozhikode", code: "KZK" },
            { name: "Malappuram", code: "MLP" },
            { name: "Palakkad", code: "PKD" },
            { name: "Thiruvananthapuram", code: "TVM" },
            { name: "Thrissur", code: "TSR" },
        ]
    },
    {
        name: "Ladakh",
        code: "LA",
        districts: [
            { name: "Kargil", code: "KGL" },
            { name: "Leh", code: "LEH" },
        ]
    },
    {
        name: "Madhya Pradesh",
        code: "MP",
        districts: [
            { name: "Bhopal", code: "BPL" },
            { name: "Gwalior", code: "GWL" },
            { name: "Indore", code: "IDR" },
            { name: "Jabalpur", code: "JBP" },
            { name: "Rewa", code: "RWA" },
            { name: "Sagar", code: "SGR" },
            { name: "Satna", code: "STN" },
            { name: "Ujjain", code: "UJN" },
        ]
    },
    {
        name: "Maharashtra",
        code: "MH",
        districts: [
            { name: "Ahmednagar", code: "AHN" },
            { name: "Aurangabad", code: "AUR" },
            { name: "Kolhapur", code: "KLP" },
            { name: "Mumbai City", code: "MUM" },
            { name: "Mumbai Suburban", code: "MBS" },
            { name: "Nagpur", code: "NGP" },
            { name: "Nashik", code: "NSK" },
            { name: "Pune", code: "PUN" },
            { name: "Solapur", code: "SLP" },
            { name: "Thane", code: "THN" },
        ]
    },
    {
        name: "Manipur",
        code: "MN",
        districts: [
            { name: "Imphal East", code: "IME" },
            { name: "Imphal West", code: "IMW" },
        ]
    },
    {
        name: "Meghalaya",
        code: "ML",
        districts: [
            { name: "East Khasi Hills (Shillong)", code: "SHL" },
            { name: "West Garo Hills", code: "WGH" },
        ]
    },
    {
        name: "Mizoram",
        code: "MZ",
        districts: [
            { name: "Aizawl", code: "AZL" },
            { name: "Lunglei", code: "LGL" },
        ]
    },
    {
        name: "Nagaland",
        code: "NL",
        districts: [
            { name: "Dimapur", code: "DMP" },
            { name: "Kohima", code: "KHM" },
        ]
    },
    {
        name: "Odisha",
        code: "OD",
        districts: [
            { name: "Balasore", code: "BLS" },
            { name: "Bhubaneswar (Khordha)", code: "BBN" },
            { name: "Cuttack", code: "CTC" },
            { name: "Ganjam", code: "GJM" },
            { name: "Mayurbhanj", code: "MYB" },
            { name: "Rourkela (Sundargarh)", code: "RKL" },
            { name: "Sambalpur", code: "SBP" },
        ]
    },
    {
        name: "Punjab",
        code: "PB",
        districts: [
            { name: "Amritsar", code: "ASR" },
            { name: "Bathinda", code: "BTD" },
            { name: "Faridkot", code: "FRK" },
            { name: "Ferozepur", code: "FZR" },
            { name: "Gurdaspur", code: "GDP" },
            { name: "Hoshiarpur", code: "HSP" },
            { name: "Jalandhar", code: "JLR" },
            { name: "Ludhiana", code: "LDH" },
            { name: "Moga", code: "MOG" },
            { name: "Muktsar", code: "MKT" },
            { name: "Pathankot", code: "PTK" },
            { name: "Patiala", code: "PTL" },
            { name: "Rupnagar (Ropar)", code: "RPR" },
            { name: "Sangrur", code: "SGR" },
            { name: "SAS Nagar (Mohali)", code: "MOH" },
            { name: "SBS Nagar (Nawanshahr)", code: "NWS" },
            { name: "Tarn Taran", code: "TTN" },
        ]
    },
    {
        name: "Rajasthan",
        code: "RJ",
        districts: [
            { name: "Ajmer", code: "AJM" },
            { name: "Alwar", code: "ALW" },
            { name: "Bikaner", code: "BKN" },
            { name: "Jaipur", code: "JPR" },
            { name: "Jodhpur", code: "JDH" },
            { name: "Kota", code: "KTA" },
            { name: "Sikar", code: "SKR" },
            { name: "Udaipur", code: "UDP" },
        ]
    },
    {
        name: "Sikkim",
        code: "SK",
        districts: [
            { name: "Gangtok (East Sikkim)", code: "GTK" },
            { name: "South Sikkim", code: "SSK" },
        ]
    },
    {
        name: "Tamil Nadu",
        code: "TN",
        districts: [
            { name: "Chennai", code: "CHN" },
            { name: "Coimbatore", code: "CBE" },
            { name: "Erode", code: "ERD" },
            { name: "Kancheepuram", code: "KPM" },
            { name: "Madurai", code: "MDU" },
            { name: "Salem", code: "SLM" },
            { name: "Thanjavur", code: "TNJ" },
            { name: "Tiruchirappalli", code: "TRC" },
            { name: "Tirunelveli", code: "TNV" },
            { name: "Vellore", code: "VLR" },
        ]
    },
    {
        name: "Telangana",
        code: "TS",
        districts: [
            { name: "Hyderabad", code: "HYD" },
            { name: "Karimnagar", code: "KMN" },
            { name: "Khammam", code: "KHM" },
            { name: "Nizamabad", code: "NZB" },
            { name: "Rangareddy", code: "RRD" },
            { name: "Warangal", code: "WRG" },
        ]
    },
    {
        name: "Tripura",
        code: "TR",
        districts: [
            { name: "Agartala (West Tripura)", code: "AGT" },
            { name: "Dharmanagar", code: "DMN" },
        ]
    },
    {
        name: "Uttar Pradesh",
        code: "UP",
        districts: [
            { name: "Agra", code: "AGR" },
            { name: "Aligarh", code: "ALG" },
            { name: "Allahabad (Prayagraj)", code: "ALD" },
            { name: "Bareilly", code: "BRY" },
            { name: "Ghaziabad", code: "GZB" },
            { name: "Gorakhpur", code: "GKP" },
            { name: "Kanpur", code: "KNP" },
            { name: "Lucknow", code: "LKO" },
            { name: "Mathura", code: "MTH" },
            { name: "Meerut", code: "MRT" },
            { name: "Moradabad", code: "MBD" },
            { name: "Noida (Gautam Buddha Nagar)", code: "NOI" },
            { name: "Varanasi", code: "VNS" },
        ]
    },
    {
        name: "Uttarakhand",
        code: "UK",
        districts: [
            { name: "Dehradun", code: "DDN" },
            { name: "Haridwar", code: "HWR" },
            { name: "Nainital", code: "NNT" },
            { name: "Rishikesh", code: "RSK" },
            { name: "Roorkee", code: "RRK" },
        ]
    },
    {
        name: "West Bengal",
        code: "WB",
        districts: [
            { name: "Asansol", code: "ASN" },
            { name: "Durgapur", code: "DGP" },
            { name: "Hooghly", code: "HGH" },
            { name: "Howrah", code: "HWH" },
            { name: "Kolkata", code: "KOL" },
            { name: "Malda", code: "MLD" },
            { name: "Murshidabad", code: "MSD" },
            { name: "Nadia", code: "NDA" },
            { name: "North 24 Parganas", code: "N24" },
            { name: "Siliguri", code: "SLG" },
            { name: "South 24 Parganas", code: "S24" },
        ]
    },
    {
        name: "Andaman and Nicobar Islands",
        code: "AN",
        districts: [
            { name: "Port Blair (South Andaman)", code: "PBR" },
            { name: "Nicobar", code: "NCB" },
        ]
    },
    {
        name: "Chandigarh",
        code: "CH",
        districts: [
            { name: "Chandigarh", code: "CHD" },
        ]
    },
    {
        name: "Dadra and Nagar Haveli and Daman and Diu",
        code: "DD",
        districts: [
            { name: "Daman", code: "DMN" },
            { name: "Diu", code: "DIU" },
            { name: "Silvassa", code: "SLV" },
        ]
    },
    {
        name: "Lakshadweep",
        code: "LD",
        districts: [
            { name: "Kavaratti", code: "KVT" },
        ]
    },
    {
        name: "Puducherry",
        code: "PY",
        districts: [
            { name: "Karaikal", code: "KKL" },
            { name: "Mahe", code: "MAH" },
            { name: "Puducherry", code: "PDY" },
            { name: "Yanam", code: "YNM" },
        ]
    },
];

// Helper functions
export function getStateByCode(code: string): State | undefined {
    return indianStates.find(s => s.code === code);
}

export function getStateByName(name: string): State | undefined {
    return indianStates.find(s => s.name.toLowerCase() === name.toLowerCase());
}

export function getDistrictsByState(stateCode: string): District[] {
    const state = getStateByCode(stateCode);
    return state?.districts || [];
}

export function getDistrictsByStateName(stateName: string): District[] {
    const state = getStateByName(stateName);
    return state?.districts || [];
}

export function getAllStateNames(): string[] {
    return indianStates.map(s => s.name).sort();
}
