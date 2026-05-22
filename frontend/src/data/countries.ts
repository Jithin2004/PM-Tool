export interface Country {
  code: string;
  name: string;
  states: { code: string; name: string }[];
}

export const COUNTRIES: Country[] = [
  {
    code: 'US', name: 'United States', states: [
      { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
      { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
      { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
      { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
      { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
      { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
      { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
      { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
      { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
      { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
      { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
      { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
      { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
      { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
      { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
      { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
      { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
      { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
      { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
      { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
      { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
      { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
      { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
      { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
      { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
    ]
  },
  {
    code: 'IN', name: 'India', states: [
      { code: 'AP', name: 'Andhra Pradesh' }, { code: 'AR', name: 'Arunachal Pradesh' },
      { code: 'AS', name: 'Assam' }, { code: 'BR', name: 'Bihar' },
      { code: 'CG', name: 'Chhattisgarh' }, { code: 'GA', name: 'Goa' },
      { code: 'GJ', name: 'Gujarat' }, { code: 'HR', name: 'Haryana' },
      { code: 'HP', name: 'Himachal Pradesh' }, { code: 'JH', name: 'Jharkhand' },
      { code: 'KA', name: 'Karnataka' }, { code: 'KL', name: 'Kerala' },
      { code: 'MP', name: 'Madhya Pradesh' }, { code: 'MH', name: 'Maharashtra' },
      { code: 'MN', name: 'Manipur' }, { code: 'ML', name: 'Meghalaya' },
      { code: 'MZ', name: 'Mizoram' }, { code: 'NL', name: 'Nagaland' },
      { code: 'OD', name: 'Odisha' }, { code: 'PB', name: 'Punjab' },
      { code: 'RJ', name: 'Rajasthan' }, { code: 'SK', name: 'Sikkim' },
      { code: 'TN', name: 'Tamil Nadu' }, { code: 'TS', name: 'Telangana' },
      { code: 'TR', name: 'Tripura' }, { code: 'UP', name: 'Uttar Pradesh' },
      { code: 'UK', name: 'Uttarakhand' }, { code: 'WB', name: 'West Bengal' },
    ]
  },
  {
    code: 'GB', name: 'United Kingdom', states: [
      { code: 'ENG', name: 'England' }, { code: 'SCT', name: 'Scotland' },
      { code: 'WLS', name: 'Wales' }, { code: 'NIR', name: 'Northern Ireland' },
    ]
  },
  {
    code: 'CA', name: 'Canada', states: [
      { code: 'AB', name: 'Alberta' }, { code: 'BC', name: 'British Columbia' },
      { code: 'MB', name: 'Manitoba' }, { code: 'NB', name: 'New Brunswick' },
      { code: 'NL', name: 'Newfoundland and Labrador' },
      { code: 'NS', name: 'Nova Scotia' }, { code: 'ON', name: 'Ontario' },
      { code: 'PE', name: 'Prince Edward Island' }, { code: 'QC', name: 'Quebec' },
      { code: 'SK', name: 'Saskatchewan' },
    ]
  },
  {
    code: 'AU', name: 'Australia', states: [
      { code: 'NSW', name: 'New South Wales' }, { code: 'QLD', name: 'Queensland' },
      { code: 'SA', name: 'South Australia' }, { code: 'TAS', name: 'Tasmania' },
      { code: 'VIC', name: 'Victoria' }, { code: 'WA', name: 'Western Australia' },
    ]
  },
  {
    code: 'DE', name: 'Germany', states: [
      { code: 'BW', name: 'Baden-Württemberg' }, { code: 'BY', name: 'Bavaria' },
      { code: 'BE', name: 'Berlin' }, { code: 'BB', name: 'Brandenburg' },
      { code: 'HB', name: 'Bremen' }, { code: 'HH', name: 'Hamburg' },
      { code: 'HE', name: 'Hesse' }, { code: 'NI', name: 'Lower Saxony' },
      { code: 'MV', name: 'Mecklenburg-Vorpommern' },
      { code: 'NW', name: 'North Rhine-Westphalia' },
      { code: 'RP', name: 'Rhineland-Palatinate' }, { code: 'SL', name: 'Saarland' },
      { code: 'SN', name: 'Saxony' }, { code: 'ST', name: 'Saxony-Anhalt' },
      { code: 'SH', name: 'Schleswig-Holstein' }, { code: 'TH', name: 'Thuringia' },
    ]
  },
  {
    code: 'FR', name: 'France', states: [
      { code: 'ARA', name: 'Auvergne-Rhône-Alpes' },
      { code: 'BFC', name: 'Bourgogne-Franche-Comté' },
      { code: 'BRE', name: 'Brittany' }, { code: 'CVL', name: 'Centre-Val de Loire' },
      { code: 'COR', name: 'Corsica' }, { code: 'GES', name: 'Grand Est' },
      { code: 'HDF', name: 'Hauts-de-France' },
      { code: 'IDF', name: 'Île-de-France' },
      { code: 'NOR', name: 'Normandy' }, { code: 'NAQ', name: 'Nouvelle-Aquitaine' },
      { code: 'OCC', name: 'Occitanie' }, { code: 'PDL', name: 'Pays de la Loire' },
      { code: 'PAC', name: 'Provence-Alpes-Côte d\'Azur' },
    ]
  },
  {
    code: 'JP', name: 'Japan', states: [
      { code: 'HKD', name: 'Hokkaido' }, { code: 'AOM', name: 'Aomori' },
      { code: 'TKY', name: 'Tokyo' }, { code: 'OSK', name: 'Osaka' },
      { code: 'KYO', name: 'Kyoto' }, { code: 'KNG', name: 'Kanagawa' },
    ]
  },
  {
    code: 'BR', name: 'Brazil', states: [
      { code: 'SP', name: 'São Paulo' }, { code: 'RJ', name: 'Rio de Janeiro' },
      { code: 'MG', name: 'Minas Gerais' }, { code: 'BA', name: 'Bahia' },
      { code: 'RS', name: 'Rio Grande do Sul' }, { code: 'PR', name: 'Paraná' },
      { code: 'PE', name: 'Pernambuco' }, { code: 'CE', name: 'Ceará' },
      { code: 'PA', name: 'Pará' }, { code: 'SC', name: 'Santa Catarina' },
      { code: 'DF', name: 'Distrito Federal' },
    ]
  },
  {
    code: 'SG', name: 'Singapore', states: []
  },
  {
    code: 'AE', name: 'United Arab Emirates', states: [
      { code: 'DXB', name: 'Dubai' }, { code: 'AUH', name: 'Abu Dhabi' },
      { code: 'SHJ', name: 'Sharjah' },
    ]
  },
  {
    code: 'NL', name: 'Netherlands', states: []
  },
  {
    code: 'SE', name: 'Sweden', states: []
  },
];

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code || c.name.toLowerCase() === code.toLowerCase());
}

export function findCountries(query: string): Country[] {
  const q = query.toLowerCase();
  return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
}
