export interface Character {
  id: string;
  name: string;
  image: string;
}

export const CHARACTERS: Record<string, Character> = {
  hitch: {
    id: 'hitch',
    name: 'Hitch',
    image: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png',
  },
  wallet: {
    id: 'wallet',
    name: 'Wallet',
    image: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218458/rvunicorn/guides/wallet_guide.png',
  },
  walter: {
    id: 'walter',
    name: 'Walter',
    image: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261024/rvunicorn/characters/walter.png',
  },
  rose: {
    id: 'rose',
    name: 'Rosé',
    image: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261022/rvunicorn/characters/rose.png',
  },
  diesel: {
    id: 'diesel',
    name: 'Diesel Dave',
    image: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261021/rvunicorn/characters/diesel.png',
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    image: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261023/rvunicorn/characters/scout.png',
  },
  luna: {
    id: 'luna',
    name: 'Luna',
    image: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261086/rvunicorn/characters/luna.webp',
  },
  ranger_rick: {
    id: 'ranger_rick',
    name: 'Ranger Rick',
    image: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261025/rvunicorn/characters/ranger_rick.jpg',
  },
  holden: {
    id: 'holden',
    name: 'Holden',
    image: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1781042437/rvunicorn/characters/holden.jpg',
  },
  hannah: {
    id: 'hannah',
    name: 'Hannah',
    image: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1781042437/rvunicorn/characters/hannah.jpg',
  },
};

// Aliases for matching various name formats
const ALIASES: Record<string, string> = {
  'ranger rick': 'ranger_rick',
  'rangerrick': 'ranger_rick',
  'ranger': 'ranger_rick',
  'rosé': 'rose',
  'rose': 'rose',
  'diesel dave': 'diesel',
  'diesel': 'diesel',
  'pebble': 'wallet',
  'holden': 'holden',
  'hannah': 'hannah',
  'holden & hannah': 'holden',
  'holden_hannah': 'holden',
  'junior ranger': 'holden',
  'junior rangers': 'holden',
};

export function getCharacter(nameOrId: string): Character {
  const key = nameOrId.toLowerCase().trim();
  return CHARACTERS[key] || CHARACTERS[ALIASES[key]] || CHARACTERS.hitch;
}

export function getCharacterImage(nameOrId: string): string {
  return getCharacter(nameOrId).image;
}

export function getCharacterName(nameOrId: string): string {
  return getCharacter(nameOrId).name;
}
