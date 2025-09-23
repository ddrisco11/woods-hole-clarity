export interface ClaritySite {
  id: string;
  name: string;
  description: string;
  clarityScore: number;
  position: { x: number; y: number };
  tidePhase: 'rising' | 'falling' | 'slack';
  windExposure: 'protected' | 'moderate' | 'exposed';
  forecast: Array<{ time: string; score: number }>;
}

export const mockClaritySites: ClaritySite[] = [
  {
    id: 'stoney-beach',
    name: 'Stoney Beach',
    description: 'Popular diving & snorkeling spot',
    clarityScore: 82,
    position: { x: 35, y: 60 },
    tidePhase: 'rising',
    windExposure: 'protected',
    forecast: [
      { time: '2:00 PM', score: 82 },
      { time: '3:00 PM', score: 84 },
      { time: '4:00 PM', score: 86 },
      { time: '5:00 PM', score: 88 },
    ]
  },
  {
    id: 'devils-foot',
    name: "Devil's Foot",
    description: 'Rock formation with clear water',
    clarityScore: 78,
    position: { x: 55, y: 45 },
    tidePhase: 'slack',
    windExposure: 'moderate',
    forecast: [
      { time: '2:00 PM', score: 78 },
      { time: '3:00 PM', score: 82 },
      { time: '4:00 PM', score: 86 },
      { time: '5:00 PM', score: 88 },
    ]
  },
  {
    id: 'great-harbor',
    name: 'Great Harbor',
    description: 'Main harbor area',
    clarityScore: 45,
    position: { x: 25, y: 75 },
    tidePhase: 'falling',
    windExposure: 'protected',
    forecast: [
      { time: '2:00 PM', score: 45 },
      { time: '3:00 PM', score: 48 },
      { time: '4:00 PM', score: 52 },
      { time: '5:00 PM', score: 55 },
    ]
  },
  {
    id: 'juniper-point',
    name: 'Juniper Point',
    description: 'Rocky shoreline with good visibility',
    clarityScore: 72,
    position: { x: 70, y: 35 },
    tidePhase: 'rising',
    windExposure: 'exposed',
    forecast: [
      { time: '2:00 PM', score: 72 },
      { time: '3:00 PM', score: 74 },
      { time: '4:00 PM', score: 76 },
      { time: '5:00 PM', score: 78 },
    ]
  },
  {
    id: 'hadley-harbor',
    name: 'Hadley Harbor',
    description: 'Sheltered cove',
    clarityScore: 65,
    position: { x: 80, y: 55 },
    tidePhase: 'slack',
    windExposure: 'protected',
    forecast: [
      { time: '2:00 PM', score: 65 },
      { time: '3:00 PM', score: 68 },
      { time: '4:00 PM', score: 70 },
      { time: '5:00 PM', score: 72 },
    ]
  },
  {
    id: 'eel-pond',
    name: 'Eel Pond',
    description: 'Shallow tidal pond',
    clarityScore: 58,
    position: { x: 40, y: 80 },
    tidePhase: 'falling',
    windExposure: 'protected',
    forecast: [
      { time: '2:00 PM', score: 58 },
      { time: '3:00 PM', score: 60 },
      { time: '4:00 PM', score: 62 },
      { time: '5:00 PM', score: 65 },
    ]
  }
];