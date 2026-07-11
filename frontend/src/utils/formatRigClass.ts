const RIG_CLASS_LABELS: Record<string, string> = {
  CLASS_A: 'Class A',
  CLASS_B: 'Class B',
  CLASS_C: 'Class C',
  FIFTH_WHEEL: 'Fifth Wheel',
  TRAVEL_TRAILER: 'Travel Trailer',
  TOY_HAULER: 'Toy Hauler',
  POP_UP: 'Pop-up Camper',
  POPUP: 'Pop-up Camper',
  TRUCK_CAMPER: 'Truck Camper',
  MOTORHOME: 'Motorhome',
  VAN: 'Van Conversion',
};

export function formatRigClass(rigClass: string | null | undefined): string {
  if (!rigClass) return '';
  return RIG_CLASS_LABELS[rigClass] || rigClass.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
